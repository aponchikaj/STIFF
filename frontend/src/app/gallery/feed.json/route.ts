import {
  FEED_DESCRIPTION,
  FEED_REVALIDATE_SECONDS,
  FEED_TITLE,
  feedEntry,
  fetchFeedShots,
} from "@/lib/gallery-feed";
import { SITE_URL } from "@/lib/site";

export const revalidate = 900;

/**
 * JSON Feed 1.1.
 *
 * The same archive as the RSS, for anything that would rather not parse XML.
 * `image` is the item's own field in this format, so a photograph does not
 * have to be smuggled through an HTML body the way RSS makes you.
 */
export async function GET() {
  const shots = await fetchFeedShots();

  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: FEED_TITLE,
    description: FEED_DESCRIPTION,
    home_page_url: `${SITE_URL}/gallery`,
    feed_url: `${SITE_URL}/gallery/feed.json`,
    language: "en",
    authors: [{ name: "STIFF", url: SITE_URL }],
    items: shots.map((shot) => {
      const entry = feedEntry(shot);
      return {
        id: entry.url,
        url: entry.url,
        title: shot.title,
        content_text: entry.summary,
        image: entry.image,
        date_published: new Date(shot.createdAt).toISOString(),
        ...(shot.tags?.length
          ? { tags: shot.tags.map((tag) => tag.label) }
          : {}),
      };
    }),
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      "Content-Type": "application/feed+json; charset=utf-8",
      "Cache-Control": `public, max-age=0, s-maxage=${FEED_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
