import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * The latest posts, fetched here rather than in the browser.
 *
 * Instagram's API needs a long-lived access token, and a token that reaches a
 * browser is a token anybody can read and use until it expires. So the site
 * never talks to Instagram: it asks this, and this holds the credential.
 *
 * It is also cached, because the alternative is one Instagram request per
 * visitor — which is both slow on the critical path of the home page and a
 * quick way to meet their rate limit on a good day.
 */

const GRAPH_URL = 'https://graph.instagram.com/me/media';
const FIELDS =
  'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp';

/** Six fills one row and no more; the strip is a signal, not a feed reader. */
const LIMIT = 6;

/** Instagram is not a news wire and this sits on the home page's critical path. */
const CACHE_MS = 30 * 60 * 1000;

/** Never let a slow third party hold the page open. */
const TIMEOUT_MS = 4000;

export interface InstagramPost {
  id: string;
  caption: string | null;
  /** Always an image URL — a video's thumbnail rather than the video. */
  imageUrl: string;
  permalink: string;
  timestamp: string;
  isVideo: boolean;
}

export interface InstagramStrip {
  /** False when no token is set. The site then links out instead. */
  configured: boolean;
  posts: InstagramPost[];
  /** Present when configured but the last fetch did not work. */
  error?: string;
}

interface GraphMedia {
  id?: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  timestamp?: string;
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);
  private cache: { at: number; value: InstagramStrip } | null = null;

  constructor(private readonly configService: ConfigService) {}

  private get token(): string | undefined {
    return this.configService.get<string>('INSTAGRAM_ACCESS_TOKEN');
  }

  async strip(): Promise<InstagramStrip> {
    if (!this.token) return { configured: false, posts: [] };

    const now = Date.now();
    if (this.cache && now - this.cache.at < CACHE_MS) return this.cache.value;

    const value = await this.fetchPosts();

    /**
     * A failed fetch does not evict a good cache.
     *
     * Instagram tokens expire and their API has bad afternoons. Keeping the
     * last good answer means the strip goes stale rather than empty, and an
     * empty strip on the home page is the visible version of an outage.
     */
    if (value.error && this.cache) {
      this.logger.warn(`Instagram fetch failed, serving cache: ${value.error}`);
      return this.cache.value;
    }

    this.cache = { at: now, value };
    return value;
  }

  private async fetchPosts(): Promise<InstagramStrip> {
    const url = `${GRAPH_URL}?fields=${FIELDS}&limit=${LIMIT}&access_token=${encodeURIComponent(
      this.token ?? '',
    )}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) {
        // The token is in the URL, so the response body is the only thing safe
        // to log — never the request.
        return {
          configured: true,
          posts: [],
          error: `Instagram returned ${res.status}`,
        };
      }

      const body = (await res.json()) as { data?: GraphMedia[] };
      const posts = (body.data ?? [])
        .map((item) => this.toPost(item))
        .filter((post): post is InstagramPost => post !== null);

      return { configured: true, posts };
    } catch (error) {
      return {
        configured: true,
        posts: [],
        error: error instanceof Error ? error.message : 'Instagram unreachable',
      };
    }
  }

  private toPost(item: GraphMedia): InstagramPost | null {
    // A video's `media_url` is the video file. The thumbnail is the only thing
    // that belongs in an image strip, and a post without either is not one we
    // can show.
    const isVideo = item.media_type === 'VIDEO';
    const imageUrl = isVideo ? item.thumbnail_url : item.media_url;
    if (!item.id || !item.permalink || !imageUrl) return null;

    return {
      id: item.id,
      caption: item.caption?.trim() || null,
      imageUrl,
      permalink: item.permalink,
      timestamp: item.timestamp ?? '',
      isVideo,
    };
  }
}
