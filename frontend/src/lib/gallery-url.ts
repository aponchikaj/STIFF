/**
 * Gallery shots are addressed by their stable URL slug — /gallery/{slug}
 * rather than a UUID.
 *
 * For safety/compat, if a caller only has `title`, we fall back to it.
 */
export function galleryPath(item: { slug?: string; title: string }): string {
  const slug = item.slug ?? item.title;
  return `/gallery/${encodeURIComponent(slug)}`;
}
