/**
 * Gallery shots are addressed by their title — /gallery/0001 rather than a
 * UUID. Titles are unique (enforced by a unique index on the column), so the
 * title is a stable, readable slug.
 *
 * The API still resolves a raw UUID, so links shared before the switch keep
 * working; nothing in the app should generate them any more.
 */
export function galleryPath(item: { title: string }): string {
  return `/gallery/${encodeURIComponent(item.title)}`;
}
