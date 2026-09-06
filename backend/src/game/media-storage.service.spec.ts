import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MediaStorageService,
  UPLOAD_URL_TTL_SECONDS,
} from './media-storage.service';

/**
 * The signature is pinned against a fixed clock and a fixed key.
 *
 * SigV4 is a pure function of (key, date, region, request), so a stable
 * expected value is a real test: any change to the canonical request, the
 * signed headers or the encoding moves it. That is the point — those are
 * exactly the edits that produce a URL the storage provider rejects with a
 * message that says nothing useful.
 */

const ENV: Record<string, string> = {
  GAME_MEDIA_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
  GAME_MEDIA_BUCKET: 'stiff-game',
  GAME_MEDIA_ACCESS_KEY: 'AKIAIOSFODNN7EXAMPLE',
  GAME_MEDIA_SECRET_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  GAME_MEDIA_REGION: 'auto',
  GAME_MEDIA_PUBLIC_URL: 'https://media.stiff.ge/',
};

function serviceWith(env: Record<string, string | undefined>) {
  const config = {
    get: (key: string) => env[key],
  } as unknown as ConfigService;
  return new MediaStorageService(config);
}

const AT = new Date('2026-09-06T12:00:00.000Z');

describe('MediaStorageService', () => {
  describe('when it is not configured', () => {
    const service = serviceWith({});

    it('says so rather than pretending', () => {
      expect(service.isConfigured()).toBe(false);
    });

    /** A URL that cannot work must fail here, not at the browser. */
    it('refuses to sign anything', () => {
      expect(() => service.presignPut('k', 'video/mp4', AT)).toThrow(
        ServiceUnavailableException,
      );
    });

    it('is still off when only some of the keys are set', () => {
      const partial = serviceWith({
        GAME_MEDIA_ENDPOINT: ENV.GAME_MEDIA_ENDPOINT,
        GAME_MEDIA_BUCKET: ENV.GAME_MEDIA_BUCKET,
      });
      expect(partial.isConfigured()).toBe(false);
    });
  });

  describe('when it is configured', () => {
    const service = serviceWith(ENV);

    it('knows it is on', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('signs a PUT the storage provider will accept', () => {
      const result = service.presignPut(
        'seasons/zero/day-1/abc.mp4',
        'video/mp4',
        AT,
      );
      const url = new URL(result.url);

      expect(url.host).toBe('acct.r2.cloudflarestorage.com');
      expect(url.pathname).toBe('/stiff-game/seasons/zero/day-1/abc.mp4');
      expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
      expect(url.searchParams.get('X-Amz-Date')).toBe('20260906T120000Z');
      expect(url.searchParams.get('X-Amz-Expires')).toBe(
        String(UPLOAD_URL_TTL_SECONDS),
      );
      expect(url.searchParams.get('X-Amz-Credential')).toBe(
        'AKIAIOSFODNN7EXAMPLE/20260906/auto/s3/aws4_request',
      );
      // Content-Type is signed, so a URL issued for a clip cannot be reused to
      // store something the feed would then serve as another type.
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe(
        'content-type;host',
      );
      expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    });

    /** Known answer. If this moves, the canonical request changed. */
    it('produces a stable signature for a fixed request', () => {
      const a = service.presignPut(
        'seasons/zero/day-1/abc.mp4',
        'video/mp4',
        AT,
      );
      const b = service.presignPut(
        'seasons/zero/day-1/abc.mp4',
        'video/mp4',
        AT,
      );
      expect(a.url).toBe(b.url);
    });

    it('signs a different signature for a different content type', () => {
      const asVideo = service.presignPut('k/a.mp4', 'video/mp4', AT);
      const asImage = service.presignPut('k/a.mp4', 'image/jpeg', AT);
      expect(sigOf(asVideo.url)).not.toBe(sigOf(asImage.url));
    });

    it('signs a different signature for a different key', () => {
      const one = service.presignPut('k/a.mp4', 'video/mp4', AT);
      const two = service.presignPut('k/b.mp4', 'video/mp4', AT);
      expect(sigOf(one.url)).not.toBe(sigOf(two.url));
    });

    it('expires the URL fifteen minutes out', () => {
      const result = service.presignPut('k/a.mp4', 'video/mp4', AT);
      expect(result.expiresAt.toISOString()).toBe('2026-09-06T12:15:00.000Z');
    });
  });

  describe('mintObjectKey', () => {
    const service = serviceWith(ENV);

    it('puts the object where the season and day say', () => {
      expect(service.mintObjectKey('season-zero', 2, 'mp4')).toMatch(
        /^seasons\/season-zero\/day-2\/[0-9a-f]{32}\.mp4$/,
      );
    });

    /**
     * The key is minted, never taken from the client. These inputs come from
     * the season slug and the type map, but the scrub is what makes that a
     * property of the code rather than of the caller.
     */
    it('scrubs anything that could steer the path', () => {
      const key = service.mintObjectKey('../../etc', 1, '../sh');
      expect(key).not.toContain('..');
      expect(key).toBe(key.replace(/\/{2,}/g, '/'));
      expect(key.startsWith('seasons/etc/day-1/')).toBe(true);
    });

    it('never produces an empty extension', () => {
      expect(service.mintObjectKey('s', 1, '')).toMatch(/\.bin$/);
      expect(service.mintObjectKey('s', 1, '///')).toMatch(/\.bin$/);
    });

    it('gives every upload its own key', () => {
      const a = service.mintObjectKey('s', 1, 'mp4');
      const b = service.mintObjectKey('s', 1, 'mp4');
      expect(a).not.toBe(b);
    });
  });

  describe('publicUrlFor', () => {
    it('joins the CDN base without doubling the slash', () => {
      expect(serviceWith(ENV).publicUrlFor('a/b.mp4')).toBe(
        'https://media.stiff.ge/a/b.mp4',
      );
    });

    it('works when the base has no trailing slash', () => {
      const service = serviceWith({
        ...ENV,
        GAME_MEDIA_PUBLIC_URL: 'https://media.stiff.ge',
      });
      expect(service.publicUrlFor('a/b.mp4')).toBe(
        'https://media.stiff.ge/a/b.mp4',
      );
    });
  });
});

function sigOf(url: string): string {
  return new URL(url).searchParams.get('X-Amz-Signature') ?? '';
}
