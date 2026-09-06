import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes } from 'crypto';

/**
 * Hands the browser a URL it can `PUT` a file to, directly.
 *
 * Media never passes through this app — that is the rule the whole media
 * budget rests on (`docs/game/hosting.md`). The browser asks for a URL, uploads
 * to object storage itself, and comes back with "done". Nest sees a few hundred
 * bytes of JSON either way, whether the file was a 400 KB still or a 40 MB clip.
 *
 * Signed here rather than with an SDK. This is SigV4 against an S3-compatible
 * endpoint (Cloudflare R2 speaks it, so does S3), it is about seventy lines of
 * HMAC, and `media-storage.service.spec.ts` pins it against a fixed clock and
 * key. Adding an AWS SDK to sign one URL would be the larger risk.
 *
 * Unconfigured, every call fails loudly rather than half-working: an upload
 * path that silently returns a useless URL is worse than one that is plainly off.
 */

const ALGORITHM = 'AWS4-HMAC-SHA256';
const SERVICE = 's3';

/** Long enough for a 40 MB clip on a slow phone, short enough to matter. */
export const UPLOAD_URL_TTL_SECONDS = 15 * 60;

export interface PresignedUpload {
  url: string;
  objectKey: string;
  expiresAt: Date;
}

@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);

  constructor(private readonly config: ConfigService) {
    if (!this.isConfigured()) {
      this.logger.warn(
        'GAME_MEDIA_* not fully set — uploads are disabled on this instance',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('GAME_MEDIA_ENDPOINT') &&
      this.config.get<string>('GAME_MEDIA_BUCKET') &&
      this.config.get<string>('GAME_MEDIA_ACCESS_KEY') &&
      this.config.get<string>('GAME_MEDIA_SECRET_KEY'),
    );
  }

  /** A key the client never chooses, so a filename cannot steer where it lands. */
  mintObjectKey(seasonSlug: string, day: number, extension: string): string {
    const safeSeason = seasonSlug.replace(/[^a-z0-9-]/gi, '').slice(0, 40);
    const safeExt = extension.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
    return `seasons/${safeSeason}/day-${day}/${randomBytes(16).toString('hex')}.${safeExt}`;
  }

  /** Where the CDN will serve the finished object from. */
  publicUrlFor(objectKey: string): string {
    const base = (
      this.config.get<string>('GAME_MEDIA_PUBLIC_URL') ?? ''
    ).replace(/\/+$/, '');
    return `${base}/${objectKey}`;
  }

  presignPut(
    objectKey: string,
    contentType: string,
    now = new Date(),
  ): PresignedUpload {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Uploads are not available right now.',
      );
    }

    const endpoint = this.required('GAME_MEDIA_ENDPOINT').replace(/\/+$/, '');
    const bucket = this.required('GAME_MEDIA_BUCKET');
    const accessKey = this.required('GAME_MEDIA_ACCESS_KEY');
    const secretKey = this.required('GAME_MEDIA_SECRET_KEY');
    // R2 has one region and calls it `auto`; S3 callers set their own.
    const region = this.config.get<string>('GAME_MEDIA_REGION') ?? 'auto';

    const host = new URL(endpoint).host;
    const canonicalUri = `/${bucket}/${encodeKey(objectKey)}`;

    const amzDate = amzDateOf(now);
    const shortDate = amzDate.slice(0, 8);
    const scope = `${shortDate}/${region}/${SERVICE}/aws4_request`;

    // Content-Type is signed so the stored object cannot be relabelled after
    // the rules checked it — a client that asked for a video URL cannot use it
    // to upload something the feed would then serve as another type.
    const query: Record<string, string> = {
      'X-Amz-Algorithm': ALGORITHM,
      'X-Amz-Credential': `${accessKey}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(UPLOAD_URL_TTL_SECONDS),
      'X-Amz-SignedHeaders': 'content-type;host',
    };
    const canonicalQuery = Object.keys(query)
      .sort()
      .map((k) => `${rfc3986(k)}=${rfc3986(query[k])}`)
      .join('&');

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      canonicalQuery,
      `content-type:${contentType}`,
      `host:${host}`,
      '',
      'content-type;host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      ALGORITHM,
      amzDate,
      scope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signature = hmac(
      signingKey(secretKey, shortDate, region),
      stringToSign,
    ).toString('hex');

    return {
      url: `${endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`,
      objectKey,
      expiresAt: new Date(now.getTime() + UPLOAD_URL_TTL_SECONDS * 1000),
    };
  }

  private required(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new ServiceUnavailableException(
        'Uploads are not available right now.',
      );
    }
    return value;
  }
}

function signingKey(secret: string, date: string, region: string): Buffer {
  return hmac(
    hmac(hmac(hmac(`AWS4${secret}`, date), region), SERVICE),
    'aws4_request',
  );
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** SigV4 wants RFC 3986, which is stricter than `encodeURIComponent`. */
function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Each path segment is encoded; the separators are not. */
function encodeKey(objectKey: string): string {
  return objectKey.split('/').map(rfc3986).join('/');
}

function amzDateOf(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}
