import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  GoneException,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { extname } from 'path';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { CollabService, streamLocalFile } from './collab.service';
import { SESSION_TTL_MS } from './collab.constants';
import { isCrawlerUserAgent } from './collab.crypto';
import {
  GenerateCodesDto,
  ListCodesQueryDto,
  RedeemCollabDto,
  UpdateCampaignDto,
  UpdateCodeDto,
} from './dto/collab.dto';

const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.m4v'];
const VIDEO_MIME = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
];

function clientIp(req: AuthenticatedRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]?.trim();
  }
  return req.ip;
}

@Controller('collab')
/** Public redeem + admin mint, QR download, and per-code settings. */
export class CollabController {
  constructor(private readonly collabService: CollabService) {}

  // ---------- public: one-scan gate ----------

  @Public()
  @Post(':slug/redeem')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async redeem(
    @Param('slug') slug: string,
    @Body() dto: RedeemCollabDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (isCrawlerUserAgent(req.headers['user-agent'])) {
      throw new ForbiddenException('This code is not valid.');
    }
    try {
      const result = await this.collabService.redeem(
        slug,
        dto.token,
        clientIp(req),
      );
      res.cookie(this.collabService.cookieName(), result.sessionRaw, {
        ...this.collabService.cookieBase(),
        maxAge: SESSION_TTL_MS,
      });
      return {
        serial: result.serial,
        title: result.title,
        strictMode: result.strictMode,
      };
    } catch (err) {
      if (err instanceof GoneException) {
        res.clearCookie(
          this.collabService.cookieName(),
          this.collabService.cookieBase(),
        );
      }
      throw err;
    }
  }

  @Public()
  @Get(':slug/session')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  session(@Param('slug') slug: string, @Req() req: AuthenticatedRequest) {
    return this.collabService.readSession(
      slug,
      req.cookies?.[this.collabService.cookieName()],
    );
  }

  @Public()
  @Get(':slug/playback')
  @Header('Cache-Control', 'private, no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  playback(@Param('slug') slug: string, @Req() req: AuthenticatedRequest) {
    return this.collabService.playback(
      slug,
      req.cookies?.[this.collabService.cookieName()],
    );
  }

  @Public()
  @Get(':slug/media')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async media(
    @Param('slug') slug: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const { filePath, mime } = await this.collabService.localMediaPath(
      slug,
      req.cookies?.[this.collabService.cookieName()],
    );
    const info = await stat(filePath);
    const range = streamLocalFile(filePath, mime, req.headers.range, info.size);
    res.status(range.status);
    for (const [key, value] of Object.entries(range.headers)) {
      res.setHeader(key, value);
    }
    if (range.end < range.start) {
      res.end();
      return;
    }
    createReadStream(filePath, { start: range.start, end: range.end }).pipe(
      res,
    );
  }

  @Public()
  @Get(':slug/config')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  config(@Param('slug') slug: string) {
    return this.collabService.publicConfig(slug);
  }

  // ---------- admin ----------

  @Get(':slug')
  @Roles('admin')
  overview(@Param('slug') slug: string) {
    return this.collabService.overview(slug);
  }

  @Patch(':slug')
  @Roles('admin')
  update(@Param('slug') slug: string, @Body() dto: UpdateCampaignDto) {
    return this.collabService.updateSettings(slug, dto);
  }

  @Get(':slug/preview')
  @Roles('admin')
  @Header('Cache-Control', 'private, no-store')
  preview(@Param('slug') slug: string) {
    return this.collabService.previewPlayback(slug);
  }

  @Get(':slug/preview/media')
  @Roles('admin')
  async previewMedia(
    @Param('slug') slug: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const { filePath, mime } =
      await this.collabService.adminLocalMediaPath(slug);
    const info = await stat(filePath);
    const range = streamLocalFile(filePath, mime, req.headers.range, info.size);
    res.status(range.status);
    for (const [key, value] of Object.entries(range.headers)) {
      res.setHeader(key, value);
    }
    if (range.end < range.start) {
      res.end();
      return;
    }
    createReadStream(filePath, { start: range.start, end: range.end }).pipe(
      res,
    );
  }

  @Post(':slug/codes/generate')
  @Roles('admin')
  generate(@Param('slug') slug: string, @Body() dto: GenerateCodesDto) {
    return this.collabService.generateCodes(slug, dto.count ?? 300);
  }

  @Get(':slug/codes')
  @Roles('admin')
  listCodes(@Param('slug') slug: string, @Query() query: ListCodesQueryDto) {
    return this.collabService.listCodes(
      slug,
      query.page,
      query.pageSize,
      query.status,
    );
  }

  @Get(':slug/codes/qr.zip')
  @Roles('admin')
  async qrZip(@Param('slug') slug: string, @Res() res: Response) {
    const buf = await this.collabService.buildQrZip(slug);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="stiff-${slug}-qr.zip"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buf);
  }

  @Get(':slug/codes/:id/qr')
  @Roles('admin')
  async qrPng(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.collabService.buildQrPng(slug, id);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  }

  @Get(':slug/codes/:id')
  @Roles('admin')
  revealCode(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collabService.revealCode(slug, id);
  }

  @Patch(':slug/codes/:id')
  @Roles('admin')
  updateCode(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCodeDto,
  ) {
    return this.collabService.updateCode(slug, id, dto);
  }

  @Post(':slug/codes/:id/revoke')
  @Roles('admin')
  @HttpCode(200)
  async revoke(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.collabService.revokeCode(slug, id);
    return { success: true };
  }

  @Post(':slug/codes/:id/reset')
  @Roles('admin')
  @HttpCode(200)
  async reset(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.collabService.resetCode(slug, id);
    return { success: true };
  }

  @Post(':slug/codes/:id/regenerate')
  @Roles('admin')
  @HttpCode(200)
  regenerate(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collabService.regenerateCode(slug, id);
  }

  @Delete(':slug/codes/:id')
  @Roles('admin')
  async removeCode(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.collabService.deleteCode(slug, id);
    return { success: true };
  }

  @Post(':slug/video')
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 80 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!VIDEO_EXT.includes(ext) || !VIDEO_MIME.includes(file.mimetype)) {
          cb(
            new BadRequestException('Upload an mp4, webm or mov video'),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadVideo(
    @Param('slug') slug: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    await this.collabService.storeVideo(slug, file);
    return { success: true };
  }

  @Delete(':slug/video')
  @Roles('admin')
  async deleteVideo(@Param('slug') slug: string) {
    await this.collabService.removeVideo(slug);
    return { success: true };
  }
}
