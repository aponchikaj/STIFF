import type { GalleryItem, PaginatedShots } from "@/lib/api";
import { galleryPath } from "@/lib/gallery-url";
import { imageUrl, orientedSize } from "@/lib/image";
import { serverApiBase, SITE_URL } from "@/lib/site";

/**
 * The archive as a feed.
 *
 * A feed is how the archive gets out of the site without anyone reposting it
 * by hand: newsletter tools, Instagram schedulers and readers all speak one of
 * these two, and neither needs an API key or a person in the loop.
 */

/** Enough to be worth subscribing to, small enough to serve from one request. */
export const FEED_SIZE = 40;

/** Both feeds are re-fetched on this cadence; the archive is not a news wire. */
export const FEED_REVALIDATE_SECONDS = 900;

export const FEED_TITLE = "STIFF Archive";
export const FEED_DESCRIPTION =
  "The STIFF archive — worn, shot, kept. Lookbook photography and community shots from Tbilisi.";

/** The width a reader or a scheduler will actually re-post. */
export const FEED_IMAGE_WIDTH = 1600;

export async function fetchFeedShots(): Promise<GalleryItem[]> {
  try {
    const res = await fetch(
      `${serverApiBase()}/gallery?page=1&pageSize=${FEED_SIZE}&sort=newest`,
      { next: { revalidate: FEED_REVALIDATE_SECONDS } },
    );
    if (!res.ok) return [];
    return ((await res.json()) as PaginatedShots).items;
  } catch {
    return [];
  }
}

export interface FeedEntry {
  item: GalleryItem;
  url: string;
  image: string;
  width?: number;
  height?: number;
  summary: string;
}

export function feedEntry(item: GalleryItem): FeedEntry {
  const size = orientedSize(item.width, item.height, item.rotation);
  return {
    item,
    url: `${SITE_URL}${galleryPath(item)}`,
    image: imageUrl(item.imageUrl, FEED_IMAGE_WIDTH, "detail", item.rotation),
    width: size.width,
    height: size.height,
    // The alt text is the written description of the photograph, so it is the
    // better summary when there is one; the title is a catalogue number.
    summary:
      item.description ??
      item.altText ??
      `Shot ${item.title} from the STIFF archive.`,
  };
}

/**
 * XML text escaping.
 *
 * Every one of these fields is typed into the admin panel, so an apostrophe in
 * a caption is not a hypothetical — and a single unescaped `&` makes the whole
 * document unparseable rather than just that item.
 */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
