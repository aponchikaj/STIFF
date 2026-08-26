import {
  ConflictException,
  GoneException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import QRCode from 'qrcode';
import { CollabCampaign } from './collab-campaign.entity';
import { CollabCode } from './collab-code.entity';
import { CollabService, streamLocalFile } from './collab.service';
import { encryptToken, randomToken, sha256 } from './collab.crypto';
import { CollabSession } from './collab-session.entity';

jest.mock('qrcode', () => ({
  toBuffer: jest.fn(() =>
    Promise.resolve(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  ),
}));

const SECRET = 'test-collab-secret';
const CAMPAIGN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CODE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function campaign(overrides: Partial<CollabCampaign> = {}): CollabCampaign {
  return {
    id: CAMPAIGN_ID,
    slug: 'keburia',
    title: 'STIFF × KEBURIA',
    maxCodes: 300,
    videoProvider: 'local',
    videoPublicId: 'film.mp4',
    videoDeliveryType: null,
    videoMime: 'video/mp4',
    videoUploadedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    strictMode: true,
    ...overrides,
  };
}

function unusedCode(token: string): CollabCode {
  return {
    id: CODE_ID,
    campaignId: CAMPAIGN_ID,
    campaign: campaign(),
    serial: 7,
    tokenHash: sha256(token),
    tokenEnc: encryptToken(token, SECRET),
    status: 'unused',
    label: null,
    claimedAt: null,
    claimIpHash: null,
    createdAt: new Date(),
  };
}

describe('streamLocalFile', () => {
  it('serves the whole file when no range is sent', () => {
    const result = streamLocalFile('/x.mp4', 'video/mp4', undefined, 1000);
    expect(result.status).toBe(200);
    expect(result.start).toBe(0);
    expect(result.end).toBe(999);
    expect(result.headers['Cache-Control']).toContain('no-store');
  });

  it('honours byte ranges so the player can seek', () => {
    const result = streamLocalFile(
      '/x.mp4',
      'video/mp4',
      'bytes=100-199',
      1000,
    );
    expect(result.status).toBe(206);
    expect(result.start).toBe(100);
    expect(result.end).toBe(199);
    expect(result.headers['Content-Range']).toBe('bytes 100-199/1000');
  });

  it('rejects an unsatisfiable range', () => {
    const result = streamLocalFile('/x.mp4', 'video/mp4', 'bytes=5000-', 1000);
    expect(result.status).toBe(416);
  });
});

describe('CollabService', () => {
  let service: CollabService;
  let campaignRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let codeRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    findAndCount: jest.Mock;
    count: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let sessionRepo: { findOne: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let manager: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    count: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    campaignRepo = {
      findOne: jest.fn(),
      save: jest.fn((row: unknown) => Promise.resolve(row)),
      create: jest.fn((row: unknown) => row),
    };
    codeRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
      save: jest.fn((row: unknown) => Promise.resolve(row)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    sessionRepo = {
      findOne: jest.fn(),
      save: jest.fn((row: unknown) => Promise.resolve(row)),
      delete: jest.fn(),
    };
    manager = {
      findOne: jest.fn(),
      save: jest.fn((row: unknown) => Promise.resolve(row)),
      create: jest.fn((cls: unknown, row: unknown) => row),
      count: jest.fn().mockResolvedValue(0),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollabService,
        {
          provide: getRepositoryToken(CollabCampaign),
          useValue: campaignRepo,
        },
        { provide: getRepositoryToken(CollabCode), useValue: codeRepo },
        { provide: getRepositoryToken(CollabSession), useValue: sessionRepo },
        {
          provide: DataSource,
          useValue: {
            transaction: (cb: (m: typeof manager) => Promise<unknown>) =>
              cb(manager),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'COLLAB_TOKEN_SECRET') return SECRET;
              if (key === 'PUBLIC_SITE_URL') return 'https://stiff.ge';
              if (key === 'JWT_ACCESS_SECRET') return SECRET;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get(CollabService);
  });

  describe('redeem', () => {
    it('refuses to burn a code when the film is not uploaded yet', async () => {
      campaignRepo.findOne.mockResolvedValue(
        campaign({ videoProvider: null, videoPublicId: null }),
      );
      await expect(
        service.redeem('keburia', randomToken(), '1.1.1.1'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(manager.findOne).not.toHaveBeenCalled();
    });

    it('burns an unused code and issues a session', async () => {
      const token = randomToken();
      const row = unusedCode(token);
      campaignRepo.findOne.mockResolvedValue(campaign());
      manager.findOne.mockImplementation((cls: { name?: string }) => {
        if (cls === CollabCode) return Promise.resolve(row);
        return Promise.resolve(null);
      });

      const result = await service.redeem('keburia', token, '203.0.113.9');

      expect(result.serial).toBe('007');
      expect(result.title).toBe('STIFF × KEBURIA');
      expect(result.sessionRaw.length).toBeGreaterThan(20);
      expect(row.status).toBe('claimed');
      expect(row.claimedAt).toBeInstanceOf(Date);
      expect(row.claimIpHash).toBe(sha256('203.0.113.9'));
      expect(manager.save).toHaveBeenCalled();
    });

    it('rejects a second scan of the same code', async () => {
      const token = randomToken();
      const row = unusedCode(token);
      row.status = 'claimed';
      campaignRepo.findOne.mockResolvedValue(campaign());
      manager.findOne.mockResolvedValue(row);

      await expect(
        service.redeem('keburia', token, '1.1.1.1'),
      ).rejects.toBeInstanceOf(GoneException);
      expect(manager.delete).toHaveBeenCalled();
    });

    it('lets a claimed code open again when strict mode is off', async () => {
      const token = randomToken();
      const row = unusedCode(token);
      row.status = 'claimed';
      campaignRepo.findOne.mockResolvedValue(campaign({ strictMode: false }));
      manager.findOne.mockImplementation((cls: { name?: string }) => {
        if (cls === CollabCode) return Promise.resolve(row);
        return Promise.resolve(null);
      });

      const result = await service.redeem('keburia', token, '1.1.1.1');
      expect(result.serial).toBe('007');
      expect(result.strictMode).toBe(false);
      expect(row.status).toBe('claimed');
    });

    it('rejects a token that is not in the drop', async () => {
      campaignRepo.findOne.mockResolvedValue(campaign());
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.redeem('keburia', randomToken(), '1.1.1.1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('readSession / playback', () => {
    it('rejects a missing cookie', async () => {
      await expect(
        service.readSession('keburia', undefined),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown session cookie', async () => {
      campaignRepo.findOne.mockResolvedValue(campaign());
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(
        service.readSession('keburia', 'not-a-real-session'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns a proxy playback URL for a valid local session', async () => {
      const token = randomToken();
      const code = unusedCode(token);
      code.status = 'claimed';
      campaignRepo.findOne.mockResolvedValue(campaign());
      sessionRepo.findOne.mockResolvedValue({
        id: 'sess',
        codeId: code.id,
        campaignId: CAMPAIGN_ID,
        sessionHash: 'x',
        expiresAt: new Date(Date.now() + 60_000),
        lastSeenAt: new Date(),
        createdAt: new Date(),
        code,
      });

      const play = await service.playback('keburia', 'session-raw');
      expect(play.mode).toBe('proxy');
      expect(play.url).toBe('/collab/keburia/media');
      expect(play.serial).toBe('007');
      expect(play.strictMode).toBe(true);
    });
  });

  describe('codes', () => {
    it('saves a trimmed label on a code', async () => {
      const row = unusedCode(randomToken());
      campaignRepo.findOne.mockResolvedValue(campaign());
      codeRepo.findOne.mockResolvedValue(row);

      const updated = await service.updateCode('keburia', CODE_ID, {
        label: '  left temple  ',
      });

      expect(updated.label).toBe('left temple');
      expect(updated.serial).toBe('007');
      expect(row.label).toBe('left temple');
    });

    it('builds a PNG for an unused code', async () => {
      const row = unusedCode(randomToken());
      campaignRepo.findOne.mockResolvedValue(campaign());
      codeRepo.findOne.mockResolvedValue(row);

      const { buffer, filename } = await service.buildQrPng('keburia', CODE_ID);

      expect(filename).toBe('stiff-keburia-007.png');
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
    });

    it('encodes the admin host in the QR, not a hardcoded production URL', async () => {
      const token = randomToken();
      const row = unusedCode(token);
      campaignRepo.findOne.mockResolvedValue(campaign());
      codeRepo.findOne.mockResolvedValue(row);

      await service.buildQrPng('keburia', CODE_ID, 'https://stage.stiff.ge');

      expect(QRCode.toBuffer).toHaveBeenCalledWith(
        `https://stage.stiff.ge/c/keburia/${token}`,
        expect.any(Object),
      );
    });

    it('keeps QR origins on stiff.ge hosts and rejects the rest', () => {
      expect(service.qrBaseUrl('https://stage.stiff.ge')).toBe(
        'https://stage.stiff.ge',
      );
      expect(service.qrBaseUrl('https://pre-prod.stiff.ge/admin')).toBe(
        'https://pre-prod.stiff.ge',
      );
      expect(service.qrBaseUrl('http://localhost:3000')).toBe(
        'http://localhost:3000',
      );
      expect(service.qrBaseUrl('https://evil.example')).toBe(
        'https://stiff.ge',
      );
    });

    it('refuses the stiff.ge subdomains that are not the shop', () => {
      // These are on stiff.ge and they are the origins an admin is most likely
      // to be looking at when minting, but neither serves /c/:slug/:token. A
      // QR pointing at one is a dead link on something already printed, so it
      // falls back to the shop rather than being trusted.
      expect(service.qrBaseUrl('https://admin.stiff.ge')).toBe(
        'https://stiff.ge',
      );
      expect(service.qrBaseUrl('https://staff.stiff.ge')).toBe(
        'https://stiff.ge',
      );
    });

    it('refuses a PNG for a revoked code', async () => {
      const row = unusedCode(randomToken());
      row.status = 'revoked';
      campaignRepo.findOne.mockResolvedValue(campaign());
      codeRepo.findOne.mockResolvedValue(row);

      await expect(
        service.buildQrPng('keburia', CODE_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes a code and its sessions', async () => {
      const row = unusedCode(randomToken());
      campaignRepo.findOne.mockResolvedValue(campaign());
      codeRepo.findOne.mockResolvedValue(row);

      await service.deleteCode('keburia', CODE_ID);

      expect(sessionRepo.delete).toHaveBeenCalledWith({ codeId: CODE_ID });
      expect(codeRepo.delete).toHaveBeenCalledWith({ id: CODE_ID });
    });

    it('issues a new token when regenerating', async () => {
      const row = unusedCode(randomToken());
      const oldHash = row.tokenHash;
      campaignRepo.findOne.mockResolvedValue(campaign());
      codeRepo.findOne.mockResolvedValue(row);

      const next = await service.regenerateCode('keburia', CODE_ID);

      expect(next.status).toBe('unused');
      expect(row.tokenHash).not.toBe(oldHash);
      expect(sessionRepo.delete).toHaveBeenCalledWith({ codeId: CODE_ID });
    });

    it('reveals the scan path for an admin', async () => {
      const token = randomToken();
      const row = unusedCode(token);
      campaignRepo.findOne.mockResolvedValue(campaign());
      codeRepo.findOne.mockResolvedValue(row);

      const access = await service.revealCode('keburia', CODE_ID);

      expect(access.token).toBe(token);
      expect(access.path).toBe(`/c/keburia/${token}`);
      expect(access.serial).toBe('007');
    });
  });

  describe('generateCodes', () => {
    it('caps active codes at 300', async () => {
      campaignRepo.findOne.mockResolvedValue(campaign());
      manager.findOne.mockResolvedValue(campaign());
      const qb: Record<string, jest.Mock> = {};
      qb.where = jest.fn(() => qb);
      qb.getCount = jest.fn().mockResolvedValue(300);
      manager.createQueryBuilder.mockReturnValue(qb);

      await expect(service.generateCodes('keburia', 10)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
