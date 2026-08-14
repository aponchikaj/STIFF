import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** 192 bits of randomness, URL-safe. Guessing one unused code is not feasible. */
export function randomToken(): string {
  return randomBytes(24).toString('base64url');
}

export function randomSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function encryptToken(plain: string, secret: string): string {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function decryptToken(payload: string, secret: string): string {
  const buf = Buffer.from(payload, 'base64url');
  if (buf.length < 29) throw new Error('Invalid token payload');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const key = createHash('sha256').update(secret).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    'utf8',
  );
}

export function padSerial(serial: number): string {
  return String(serial).padStart(3, '0');
}

const CRAWLER_UA =
  /bot|crawler|spider|preview|facebookexternalhit|facebot|twitterbot|slackbot|whatsapp|telegrambot|linkedinbot|pinterest|discordbot|googlebot|bingbot|yandex|baiduspider|duckduckbot|applebot|semrush|ahrefs|iab-tech-lab|embedly|quora|redditbot|skypeuripreview/i;

export function isCrawlerUserAgent(ua: string | undefined): boolean {
  if (!ua) return false;
  return CRAWLER_UA.test(ua);
}
