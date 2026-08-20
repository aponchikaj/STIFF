/**
 * Keyset pagination for the archive.
 *
 * The grid pages by scrolling, and offset pagination drifts the moment the
 * thing it is paging over changes: reorder the archive, publish a shot, or
 * archive one, and page 3 either repeats a photograph from page 2 or skips one
 * entirely. Nobody notices until the archive is a few hundred items deep and
 * every complaint is unreproducible.
 *
 * A cursor carries the sort keys of the last row handed out, so the next page
 * is "everything after this row in this order" rather than "rows 48 to 72".
 *
 * The timestamp is carried as Postgres text, never as a JS Date. `timestamp`
 * has microsecond precision and a Date has milliseconds, so a round-tripped
 * value compares as strictly earlier than the row it came from, which makes a
 * row its own successor and repeats it on every page. The same trap is already
 * documented on `orderPredicate` in the service.
 */

export type GallerySort = 'order' | 'newest' | 'popular';

export interface GalleryCursor {
  sort: GallerySort;
  sortOrder: number;
  likeCount: number;
  /** `YYYY-MM-DDTHH:MM:SS.ffffff`, straight out of Postgres. */
  createdAt: string;
  id: string;
}

/** Rejects anything that isn't a timestamp we minted, before it reaches SQL. */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SORTS: GallerySort[] = ['order', 'newest', 'popular'];

export function encodeCursor(cursor: GalleryCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

/**
 * Decodes a cursor, or returns null.
 *
 * Null for anything malformed rather than a 400: a stale cursor from a
 * bookmarked scroll position should quietly start the archive from the top,
 * not show an error page. Every field is checked because this string comes
 * from the query string and two of them are interpolated into SQL.
 */
export function decodeCursor(
  value: string | undefined,
  sort: GallerySort,
): GalleryCursor | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (typeof parsed !== 'object' || parsed === null) return null;
    const c = parsed as Record<string, unknown>;

    if (typeof c.sort !== 'string' || !SORTS.includes(c.sort as GallerySort)) {
      return null;
    }
    // A cursor minted under one ordering means nothing under another: its
    // keys describe a position in a list that no longer exists.
    if (c.sort !== sort) return null;
    if (typeof c.id !== 'string' || !UUID.test(c.id)) return null;
    if (typeof c.createdAt !== 'string' || !TIMESTAMP.test(c.createdAt)) {
      return null;
    }
    if (!Number.isFinite(c.sortOrder) || !Number.isFinite(c.likeCount)) {
      return null;
    }

    return {
      sort,
      sortOrder: Number(c.sortOrder),
      likeCount: Number(c.likeCount),
      createdAt: c.createdAt,
      id: c.id,
    };
  } catch {
    return null;
  }
}

/**
 * The ORDER BY for a sort, always ending in `id` so the ordering is total.
 *
 * Without that last key, rows sharing a sortOrder (every admin-added shot
 * defaults to 0) have no defined order between them, and Postgres is under no
 * obligation to return them the same way twice.
 */
export function orderingFor(sort: GallerySort): [string, 'ASC' | 'DESC'][] {
  switch (sort) {
    case 'newest':
      return [
        ['item.createdAt', 'DESC'],
        ['item.id', 'ASC'],
      ];
    case 'popular':
      return [
        ['item.likeCount', 'DESC'],
        ['item.createdAt', 'DESC'],
        ['item.id', 'ASC'],
      ];
    default:
      return [
        ['item.sortOrder', 'ASC'],
        ['item.createdAt', 'DESC'],
        ['item.id', 'ASC'],
      ];
  }
}

/**
 * "Strictly after this row, in this ordering", as SQL.
 *
 * Written out longhand rather than as a row comparison because the keys run in
 * different directions and `ROW(a, b) > ROW(c, d)` has only one.
 */
export function afterCursor(cursor: GalleryCursor): {
  clause: string;
  params: Record<string, unknown>;
} {
  const params: Record<string, unknown> = {
    curCreatedAt: cursor.createdAt,
    curId: cursor.id,
  };

  const laterThan =
    '(item."createdAt" < CAST(:curCreatedAt AS timestamp) OR (item."createdAt" = CAST(:curCreatedAt AS timestamp) AND item."id" > CAST(:curId AS uuid)))';

  switch (cursor.sort) {
    case 'newest':
      return { clause: laterThan, params };
    case 'popular':
      params.curLikeCount = cursor.likeCount;
      return {
        clause: `(item."likeCount" < :curLikeCount OR (item."likeCount" = :curLikeCount AND ${laterThan}))`,
        params,
      };
    default:
      params.curSortOrder = cursor.sortOrder;
      return {
        clause: `(item."sortOrder" > :curSortOrder OR (item."sortOrder" = :curSortOrder AND ${laterThan}))`,
        params,
      };
  }
}
