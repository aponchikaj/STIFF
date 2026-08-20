import {
  FEED_DESCRIPTION,
  FEED_REVALIDATE_SECONDS,
  FEED_TITLE,
  feedEntry,
  fetchFeedShots,
  xmlEscape,
} from "@/lib/gallery-feed";
import { SITE_URL } from "@/lib/site";

export const revalidate = 900;

/**
 * RSS 2.0 with the Media RSS extension.
 *
 * Plain RSS has no field for "this item is a photograph", so a reader shows a
 * title and an empty body. `media:content` is what every scheduler and reader
 * actually looks for, and it carries the dimensions too.
 */
export async function GET() {
  const shots = await fetchFeedShots();
  const now = new Date().toUTCString();

  const items = shots
    .map((shot) => {
      const entry = feedEntry(shot);
      return `    <item>
      <title>${xmlEscape(shot.title)}</title>
      <link>${xmlEscape(entry.url)}</link>
      <guid isPermaLink="true">${xmlEscape(entry.url)}</guid>
      <pubDate>${new Date(shot.createdAt).toUTCString()}</pubDate>
      <description>${xmlEscape(entry.summary)}</description>
      <media:content url="${xmlEscape(entry.image)}" medium="image"${
        entry.width ? ` width="${entry.width}"` : ""
      }${entry.height ? ` height="${entry.height}"` : ""} />
      ${
        shot.altText
          ? `<media:description type="plain">${xmlEscape(shot.altText)}</media:description>`
          : ""
      }
      <enclosure url="${xmlEscape(entry.image)}" type="image/jpeg" />
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(FEED_TITLE)}</title>
    <link>${SITE_URL}/gallery</link>
    <description>${xmlEscape(FEED_DESCRIPTION)}</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/gallery/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": `public, max-age=0, s-maxage=${FEED_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
