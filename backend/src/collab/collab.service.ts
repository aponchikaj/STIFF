import {
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { v2 as cloudinary } from 'cloudinary';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import JSZip from 'jszip';
import { join } from 'path';
import QRCode from 'qrcode';
import { DataSource, Repository } from 'typeorm';
import { CollabCampaign } from './collab-campaign.entity';
import { CollabCode } from './collab-code.entity';
import {
  COLLAB_SESSION_COOKIE,
  DEFAULT_MAX_CODES,
  HARD_MAX_CODES,
  KEBURIA_SLUG,
  KEBURIA_TITLE,
  PLAYBACK_TTL_SEC,
  PRIVATE_MEDIA_DIR,
  SESSION_TTL_MS,
} from './collab.constants';
import {
  decryptToken,
  encryptToken,
  padSerial,
  randomSessionToken,
  randomToken,
  sha256,
} from './collab.crypto';
import { CollabSession } from './collab-session.entity';

export interface RedeemResult {
  serial: string;
  title: string;
  sessionRaw: string;
  strictMode: boolean;
}

export interface PlaybackResult {
  url: string;
  expiresAt: string | null;
  serial: string;
  title: string;
  mode: 'signed' | 'proxy';
  strictMode: boolean;
}

export interface CampaignOverview {
  slug: string;
  title: string;
  maxCodes: number;
  strictMode: boolean;
  unused: number;
  claimed: number;
  revoked: number;
  total: number;
  hasVideo: boolean;
  videoUploadedAt: string | null;
  qrBaseUrl: string;
}

export interface PublicCollabConfig {
  title: string;
  strictMode: boolean;
  hasVideo: boolean;
}

export interface CodeRow {
  id: string;
  serial: string;
  status: CollabCode['status'];
  label: string | null;
  claimedAt: string | null;
  createdAt: string;
}

@Injectable()
export class CollabService implements OnModuleInit {
  private readonly logger = new Logger(CollabService.name);
  private readonly cloudinaryEnabled: boolean;
  private readonly privateDir = join(process.cwd(), PRIVATE_MEDIA_DIR);

  constructor(
    @InjectRepository(CollabCampaign)
    private readonly campaignRepo: Repository<CollabCampaign>,
    @InjectRepository(CollabCode)
    private readonly codeRepo: Repository<CollabCode>,
    @InjectRepository(CollabSession)
    private readonly sessionRepo: Repository<CollabSession>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    this.cloudinaryEnabled = Boolean(cloudName && apiKey && apiSecret);
    if (this.cloudinaryEnabled) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
    }
  }

  async onModuleInit(): Promise<void> {
    const existing = await this.campaignRepo.findOne({
      where: { slug: KEBURIA_SLUG },
    });
    if (existing) return;
    await this.campaignRepo.save(
      this.campaignRepo.create({
        slug: KEBURIA_SLUG,
        title: KEBURIA_TITLE,
        maxCodes: DEFAULT_MAX_CODES,
        strictMode: true,
      }),
    );
    this.logger.log(`Seeded collab campaign ${KEBURIA_SLUG}`);
  }

  qrBaseUrl(): string {
    return (
      this.configService.get<string>('PUBLIC_SITE_URL') ??
      this.configService.get<string>('FRONTEND_URL') ??
      'https://stiff.ge'
    ).replace(/\/$/, '');
  }

  cookieBase() {
    const sameSite = (this.configService.get<string>('COOKIE_SAMESITE') ??
      'lax') as 'lax' | 'strict' | 'none';
    const secure =
      sameSite === 'none' ||
      this.configService.get<string>('NODE_ENV') === 'production';
    return { httpOnly: true as const, sameSite, secure, path: '/' };
  }

  cookieName(): string {
    return COLLAB_SESSION_COOKIE;
  }

  sessionTtlMs(): number {
    return SESSION_TTL_MS;
  }

  private tokenSecret(): string {
    return (
      this.configService.get<string>('COLLAB_TOKEN_SECRET') ??
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      'dev-collab-secret'
    );
  }

  async requireCampaign(slug: string): Promise<CollabCampaign> {
    const campaign = await this.campaignRepo.findOne({ where: { slug } });
    if (!campaign) throw new NotFoundException();
    return campaign;
  }

  hasVideo(campaign: CollabCampaign): boolean {
    return Boolean(campaign.videoProvider && campaign.videoPublicId);
  }

  async overview(slug: string): Promise<CampaignOverview> {
    const campaign = await this.requireCampaign(slug);
    const [unused, claimed, revoked, total] = await Promise.all([
      this.codeRepo.count({
        where: { campaignId: campaign.id, status: 'unused' },
      }),
      this.codeRepo.count({
        where: { campaignId: campaign.id, status: 'claimed' },
      }),
      this.codeRepo.count({
        where: { campaignId: campaign.id, status: 'revoked' },
      }),
      this.codeRepo.count({ where: { campaignId: campaign.id } }),
    ]);
    return {
      slug: campaign.slug,
      title: campaign.title,
      maxCodes: campaign.maxCodes,
      strictMode: campaign.strictMode,
      unused,
      claimed,
      revoked,
      total,
      hasVideo: this.hasVideo(campaign),
      videoUploadedAt: campaign.videoUploadedAt?.toISOString() ?? null,
      qrBaseUrl: this.qrBaseUrl(),
    };
  }

  async publicConfig(slug: string): Promise<PublicCollabConfig> {
    const campaign = await this.requireCampaign(slug);
    return {
      title: campaign.title,
      strictMode: campaign.strictMode,
      hasVideo: this.hasVideo(campaign),
    };
  }

  async updateSettings(
    slug: string,
    patch: { title?: string; maxCodes?: number; strictMode?: boolean },
  ): Promise<CampaignOverview> {
    const campaign = await this.requireCampaign(slug);
    if (patch.title !== undefined) campaign.title = patch.title.trim();
    if (patch.strictMode !== undefined) campaign.strictMode = patch.strictMode;
    if (patch.maxCodes !== undefined) {
      if (patch.maxCodes > HARD_MAX_CODES) {
        throw new ConflictException(`Cap cannot exceed ${HARD_MAX_CODES}.`);
      }
      const active = await this.codeRepo
        .createQueryBuilder('c')
        .where('c.campaignId = :id AND c.status IN (:...st)', {
          id: campaign.id,
          st: ['unused', 'claimed'],
        })
        .getCount();
      if (patch.maxCodes < active) {
        throw new ConflictException(
          `Cap cannot go below the ${active} codes already minted.`,
        );
      }
      campaign.maxCodes = patch.maxCodes;
    }
    await this.campaignRepo.save(campaign);
    return this.overview(slug);
  }

  async listCodes(
    slug: string,
    page: number,
    pageSize: number,
    status?: CollabCode['status'],
  ): Promise<{
    items: CodeRow[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const campaign = await this.requireCampaign(slug);
    const where = status
      ? { campaignId: campaign.id, status }
      : { campaignId: campaign.id };
    const [rows, total] = await this.codeRepo.findAndCount({
      where,
      order: { serial: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      items: rows.map((row) => this.toCodeRow(row)),
      total,
      page,
      pageSize,
    };
  }

  async generateCodes(
    slug: string,
    count: number,
  ): Promise<{ created: number; total: number }> {
    const campaign = await this.requireCampaign(slug);
    const secret = this.tokenSecret();

    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(CollabCampaign, {
        where: { id: campaign.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException();

      const active = await manager
        .createQueryBuilder(CollabCode, 'c')
        .where('c.campaignId = :id AND c.status IN (:...st)', {
          id: locked.id,
          st: ['unused', 'claimed'],
        })
        .getCount();
      const remaining = locked.maxCodes - active;
      if (remaining <= 0) {
        throw new ConflictException(
          `This drop is already at its ${locked.maxCodes} pair cap.`,
        );
      }
      const createCount = Math.min(count, remaining);

      const maxRow = await manager
        .createQueryBuilder(CollabCode, 'c')
        .select('MAX(c.serial)', 'max')
        .where('c.campaignId = :id', { id: locked.id })
        .getRawOne<{ max: string | null }>();
      let nextSerial = (maxRow?.max ? parseInt(maxRow.max, 10) : 0) + 1;

      const rows: CollabCode[] = [];
      for (let i = 0; i < createCount; i += 1) {
        const token = randomToken();
        rows.push(
          manager.create(CollabCode, {
            campaignId: locked.id,
            serial: nextSerial,
            tokenHash: sha256(token),
            tokenEnc: encryptToken(token, secret),
            status: 'unused',
          }),
        );
        nextSerial += 1;
      }
      await manager.save(rows);
      const total = await manager.count(CollabCode, {
        where: { campaignId: locked.id },
      });
      return { created: createCount, total };
    });
  }

  async buildQrZip(slug: string): Promise<Buffer> {
    const campaign = await this.requireCampaign(slug);
    const printable = await this.codeRepo.find({
      where: [
        { campaignId: campaign.id, status: 'unused' },
        { campaignId: campaign.id, status: 'claimed' },
      ],
      order: { serial: 'ASC' },
    });
    if (printable.length === 0) {
      throw new NotFoundException('No codes to print.');
    }

    const secret = this.tokenSecret();
    const base = this.qrBaseUrl();
    const zip = new JSZip();
    for (const code of printable) {
      const token = decryptToken(code.tokenEnc, secret);
      const url = `${base}/c/${campaign.slug}/${token}`;
      const filename = `stiff-${campaign.slug}-${padSerial(code.serial)}.png`;
      zip.file(filename, await this.qrPng(url));
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  async buildQrPng(
    slug: string,
    id: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const campaign = await this.requireCampaign(slug);
    const code = await this.codeRepo.findOne({
      where: { id, campaignId: campaign.id },
    });
    if (!code) throw new NotFoundException();
    if (code.status === 'revoked') {
      throw new NotFoundException('This code has been revoked.');
    }
    const token = decryptToken(code.tokenEnc, this.tokenSecret());
    const url = `${this.qrBaseUrl()}/c/${campaign.slug}/${token}`;
    const filename = `stiff-${campaign.slug}-${padSerial(code.serial)}.png`;
    return { buffer: await this.qrPng(url), filename };
  }

  async updateCode(
    slug: string,
    id: string,
    patch: { label?: string },
  ): Promise<CodeRow> {
    const campaign = await this.requireCampaign(slug);
    const code = await this.codeRepo.findOne({
      where: { id, campaignId: campaign.id },
    });
    if (!code) throw new NotFoundException();
    if (patch.label !== undefined) {
      const trimmed = patch.label.trim();
      code.label = trimmed.length > 0 ? trimmed : null;
    }
    await this.codeRepo.save(code);
    return this.toCodeRow(code);
  }

  private toCodeRow(code: CollabCode): CodeRow {
    return {
      id: code.id,
      serial: padSerial(code.serial),
      status: code.status,
      label: code.label,
      claimedAt: code.claimedAt?.toISOString() ?? null,
      createdAt: code.createdAt.toISOString(),
    };
  }

  async revealCode(
    slug: string,
    id: string,
  ): Promise<{ serial: string; token: string; path: string }> {
    const campaign = await this.requireCampaign(slug);
    const code = await this.codeRepo.findOne({
      where: { id, campaignId: campaign.id },
    });
    if (!code) throw new NotFoundException();
    const token = decryptToken(code.tokenEnc, this.tokenSecret());
    return {
      serial: padSerial(code.serial),
      token,
      path: `/c/${campaign.slug}/${token}`,
    };
  }

  private qrPng(url: string): Promise<Buffer> {
    return QRCode.toBuffer(url, {
      type: 'png',
      width: 1024,
      margin: 4,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' },
    });
  }

  async revokeCode(slug: string, id: string): Promise<void> {
    const campaign = await this.requireCampaign(slug);
    const code = await this.codeRepo.findOne({
      where: { id, campaignId: campaign.id },
    });
    if (!code) throw new NotFoundException();
    code.status = 'revoked';
    await this.codeRepo.save(code);
    await this.sessionRepo.delete({ codeId: code.id });
  }

  async resetCode(slug: string, id: string): Promise<void> {
    const campaign = await this.requireCampaign(slug);
    const code = await this.codeRepo.findOne({
      where: { id, campaignId: campaign.id },
    });
    if (!code) throw new NotFoundException();
    await this.sessionRepo.delete({ codeId: code.id });
    code.status = 'unused';
    code.claimedAt = null;
    code.claimIpHash = null;
    await this.codeRepo.save(code);
  }

  async regenerateCode(slug: string, id: string): Promise<CodeRow> {
    const campaign = await this.requireCampaign(slug);
    const code = await this.codeRepo.findOne({
      where: { id, campaignId: campaign.id },
    });
    if (!code) throw new NotFoundException();
    await this.sessionRepo.delete({ codeId: code.id });
    const token = randomToken();
    const secret = this.tokenSecret();
    code.tokenHash = sha256(token);
    code.tokenEnc = encryptToken(token, secret);
    code.status = 'unused';
    code.claimedAt = null;
    code.claimIpHash = null;
    await this.codeRepo.save(code);
    return this.toCodeRow(code);
  }

  async deleteCode(slug: string, id: string): Promise<void> {
    const campaign = await this.requireCampaign(slug);
    const code = await this.codeRepo.findOne({
      where: { id, campaignId: campaign.id },
    });
    if (!code) throw new NotFoundException();
    await this.sessionRepo.delete({ codeId: code.id });
    await this.codeRepo.delete({ id: code.id });
  }

  async redeem(
    slug: string,
    rawToken: string,
    ip: string | undefined,
  ): Promise<RedeemResult> {
    const campaign = await this.requireCampaign(slug);
    if (!this.hasVideo(campaign)) {
      throw new ServiceUnavailableException('This drop is not live yet.');
    }

    const tokenHash = sha256(rawToken);
    const secret = this.tokenSecret();

    return this.dataSource.transaction(async (manager) => {
      const code = await manager.findOne(CollabCode, {
        where: { campaignId: campaign.id, tokenHash },
        lock: { mode: 'pessimistic_write' },
      });
      if (!code) {
        throw new NotFoundException('This code is not valid.');
      }
      if (code.status === 'revoked') {
        throw new GoneException('This pair has already been opened.');
      }
      if (campaign.strictMode && code.status !== 'unused') {
        await manager.delete(CollabSession, { codeId: code.id });
        throw new GoneException('This pair has already been opened.');
      }

      // Defence in depth: the hash already matched, but refuse a swapped blob.
      try {
        const plain = decryptToken(code.tokenEnc, secret);
        if (sha256(plain) !== tokenHash) {
          throw new NotFoundException('This code is not valid.');
        }
      } catch (err) {
        if (err instanceof NotFoundException) throw err;
        throw new NotFoundException('This code is not valid.');
      }

      if (code.status === 'unused') {
        code.status = 'claimed';
        code.claimedAt = new Date();
        code.claimIpHash = ip ? sha256(ip) : null;
        await manager.save(code);
      }

      const sessionRaw = randomSessionToken();
      const existingSession = await manager.findOne(CollabSession, {
        where: { codeId: code.id },
      });
      if (existingSession) {
        existingSession.sessionHash = sha256(sessionRaw);
        existingSession.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
        existingSession.lastSeenAt = new Date();
        await manager.save(existingSession);
      } else {
        await manager.save(
          manager.create(CollabSession, {
            codeId: code.id,
            campaignId: campaign.id,
            sessionHash: sha256(sessionRaw),
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
            lastSeenAt: new Date(),
          }),
        );
      }

      return {
        serial: padSerial(code.serial),
        title: campaign.title,
        sessionRaw,
        strictMode: campaign.strictMode,
      };
    });
  }

  private async loadSession(
    slug: string,
    sessionRaw: string | undefined,
  ): Promise<{
    session: CollabSession;
    campaign: CollabCampaign;
    code: CollabCode;
  }> {
    if (!sessionRaw) throw new UnauthorizedException();
    const campaign = await this.requireCampaign(slug);
    const session = await this.sessionRepo.findOne({
      where: { sessionHash: sha256(sessionRaw), campaignId: campaign.id },
      relations: { code: true },
    });
    if (!session || !session.code) throw new UnauthorizedException();
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException();
    }
    if (session.code.status !== 'claimed') throw new UnauthorizedException();
    return { session, campaign, code: session.code };
  }

  async readSession(
    slug: string,
    sessionRaw: string | undefined,
  ): Promise<{
    serial: string;
    title: string;
    hasVideo: boolean;
    strictMode: boolean;
  }> {
    const { session, campaign, code } = await this.loadSession(
      slug,
      sessionRaw,
    );
    session.lastSeenAt = new Date();
    await this.sessionRepo.save(session);
    return {
      serial: padSerial(code.serial),
      title: campaign.title,
      hasVideo: this.hasVideo(campaign),
      strictMode: campaign.strictMode,
    };
  }

  async playback(
    slug: string,
    sessionRaw: string | undefined,
  ): Promise<PlaybackResult> {
    const { session, campaign, code } = await this.loadSession(
      slug,
      sessionRaw,
    );
    if (!this.hasVideo(campaign)) {
      throw new ServiceUnavailableException('This drop is not live yet.');
    }
    session.lastSeenAt = new Date();
    await this.sessionRepo.save(session);

    if (campaign.videoProvider === 'cloudinary' && campaign.videoPublicId) {
      const expiresAt = Math.floor(Date.now() / 1000) + PLAYBACK_TTL_SEC;
      const url = cloudinary.url(campaign.videoPublicId, {
        resource_type: 'video',
        type: campaign.videoDeliveryType || 'authenticated',
        sign_url: true,
        secure: true,
        expires_at: expiresAt,
      });
      return {
        url,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        serial: padSerial(code.serial),
        title: campaign.title,
        mode: 'signed',
        strictMode: campaign.strictMode,
      };
    }

    return {
      url: `/collab/${campaign.slug}/media`,
      expiresAt: null,
      serial: padSerial(code.serial),
      title: campaign.title,
      mode: 'proxy',
      strictMode: campaign.strictMode,
    };
  }

  async localMediaPath(
    slug: string,
    sessionRaw: string | undefined,
  ): Promise<{
    filePath: string;
    mime: string;
  }> {
    const { campaign } = await this.loadSession(slug, sessionRaw);
    if (campaign.videoProvider !== 'local' || !campaign.videoPublicId) {
      throw new NotFoundException();
    }
    const filePath = join(this.privateDir, campaign.videoPublicId);
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException();
    }
    return {
      filePath,
      mime: campaign.videoMime || 'video/mp4',
    };
  }

  async previewPlayback(slug: string): Promise<PlaybackResult> {
    const campaign = await this.requireCampaign(slug);
    if (!this.hasVideo(campaign)) {
      throw new NotFoundException('No video uploaded yet.');
    }
    if (campaign.videoProvider === 'cloudinary' && campaign.videoPublicId) {
      const expiresAt = Math.floor(Date.now() / 1000) + PLAYBACK_TTL_SEC;
      const url = cloudinary.url(campaign.videoPublicId, {
        resource_type: 'video',
        type: campaign.videoDeliveryType || 'authenticated',
        sign_url: true,
        secure: true,
        expires_at: expiresAt,
      });
      return {
        url,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        serial: '000',
        title: campaign.title,
        mode: 'signed',
        strictMode: campaign.strictMode,
      };
    }
    return {
      url: `/collab/${campaign.slug}/preview/media`,
      expiresAt: null,
      serial: '000',
      title: campaign.title,
      mode: 'proxy',
      strictMode: campaign.strictMode,
    };
  }

  async adminLocalMediaPath(slug: string): Promise<{
    filePath: string;
    mime: string;
  }> {
    const campaign = await this.requireCampaign(slug);
    if (campaign.videoProvider !== 'local' || !campaign.videoPublicId) {
      throw new NotFoundException();
    }
    const filePath = join(this.privateDir, campaign.videoPublicId);
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException();
    }
    return {
      filePath,
      mime: campaign.videoMime || 'video/mp4',
    };
  }

  async storeVideo(slug: string, file: Express.Multer.File): Promise<void> {
    const campaign = await this.requireCampaign(slug);
    await this.deleteStoredVideo(campaign);

    if (this.cloudinaryEnabled) {
      const publicId = `stiff/collab/${slug}-${randomBytes(12).toString('hex')}`;
      try {
        const result = await this.uploadCloudinary(
          file,
          publicId,
          'authenticated',
        );
        campaign.videoProvider = 'cloudinary';
        campaign.videoPublicId = result.public_id;
        campaign.videoDeliveryType = 'authenticated';
        campaign.videoMime = file.mimetype;
        campaign.videoUploadedAt = new Date();
        await this.campaignRepo.save(campaign);
        return;
      } catch (err) {
        this.logger.warn(
          `Authenticated Cloudinary upload failed (${String(err)}), retrying as private upload`,
        );
      }
      const result = await this.uploadCloudinary(file, publicId, 'upload');
      campaign.videoProvider = 'cloudinary';
      campaign.videoPublicId = result.public_id;
      campaign.videoDeliveryType = 'upload';
      campaign.videoMime = file.mimetype;
      campaign.videoUploadedAt = new Date();
      await this.campaignRepo.save(campaign);
      return;
    }

    await fs.mkdir(this.privateDir, { recursive: true });
    const ext = file.originalname.includes('.')
      ? file.originalname
          .slice(file.originalname.lastIndexOf('.'))
          .toLowerCase()
      : '.mp4';
    const name = `${slug}-${randomBytes(16).toString('hex')}${ext}`;
    await fs.writeFile(join(this.privateDir, name), file.buffer);
    campaign.videoProvider = 'local';
    campaign.videoPublicId = name;
    campaign.videoDeliveryType = null;
    campaign.videoMime = file.mimetype;
    campaign.videoUploadedAt = new Date();
    await this.campaignRepo.save(campaign);
  }

  async removeVideo(slug: string): Promise<void> {
    const campaign = await this.requireCampaign(slug);
    await this.deleteStoredVideo(campaign);
    campaign.videoProvider = null;
    campaign.videoPublicId = null;
    campaign.videoDeliveryType = null;
    campaign.videoMime = null;
    campaign.videoUploadedAt = null;
    await this.campaignRepo.save(campaign);
  }

  private async deleteStoredVideo(campaign: CollabCampaign): Promise<void> {
    if (!campaign.videoPublicId) return;
    if (campaign.videoProvider === 'cloudinary' && this.cloudinaryEnabled) {
      try {
        await cloudinary.uploader.destroy(campaign.videoPublicId, {
          resource_type: 'video',
          type: campaign.videoDeliveryType || 'authenticated',
        });
      } catch (err) {
        this.logger.warn(`Cloudinary destroy failed: ${String(err)}`);
      }
    }
    if (campaign.videoProvider === 'local') {
      try {
        await fs.unlink(join(this.privateDir, campaign.videoPublicId));
      } catch {
        // already gone
      }
    }
  }

  private uploadCloudinary(
    file: Express.Multer.File,
    publicId: string,
    type: 'authenticated' | 'upload',
  ): Promise<{ public_id: string }> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: 'video',
          type,
          overwrite: true,
        },
        (error, result) => {
          if (error || !result) {
            reject(
              error instanceof Error
                ? error
                : new Error('Cloudinary returned no result'),
            );
            return;
          }
          resolve({ public_id: result.public_id });
        },
      );
      stream.end(file.buffer);
    });
  }
}

export function streamLocalFile(
  filePath: string,
  mime: string,
  rangeHeader: string | undefined,
  fileSize: number,
): {
  status: number;
  headers: Record<string, string>;
  start: number;
  end: number;
} {
  if (!rangeHeader) {
    return {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store, no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
      start: 0,
      end: fileSize - 1,
    };
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return {
      status: 416,
      headers: {
        'Content-Range': `bytes */${fileSize}`,
        'Cache-Control': 'private, no-store',
      },
      start: 0,
      end: -1,
    };
  }
  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
  if (start > end || start >= fileSize) {
    return {
      status: 416,
      headers: {
        'Content-Range': `bytes */${fileSize}`,
        'Cache-Control': 'private, no-store',
      },
      start: 0,
      end: -1,
    };
  }
  const chunkEnd = Math.min(end, fileSize - 1);
  return {
    status: 206,
    headers: {
      'Content-Type': mime,
      'Content-Length': String(chunkEnd - start + 1),
      'Content-Range': `bytes ${start}-${chunkEnd}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store, no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
    start,
    end: chunkEnd,
  };
}
