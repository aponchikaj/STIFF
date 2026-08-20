import {
  afterCursor,
  decodeCursor,
  encodeCursor,
  GalleryCursor,
  orderingFor,
} from './cursor';

const CURSOR: GalleryCursor = {
  sort: 'order',
  sortOrder: 7,
  likeCount: 3,
  createdAt: '2026-08-20T18:04:17.123456',
  id: '11111111-1111-4111-8111-111111111111',
};

describe('gallery cursor', () => {
  it('round-trips', () => {
    expect(decodeCursor(encodeCursor(CURSOR), 'order')).toEqual(CURSOR);
  });

  it('keeps the microseconds', () => {
    // The whole reason the timestamp travels as text. A Date would truncate
    // this to .123, and .123 sorts strictly before .123456 — so the last row
    // of a page would be handed out again as the first row of the next one.
    const decoded = decodeCursor(encodeCursor(CURSOR), 'order');
    expect(decoded?.createdAt).toBe('2026-08-20T18:04:17.123456');
  });

  describe('rejects anything it did not mint', () => {
    it('refuses a cursor from a different sort', () => {
      // Its keys describe a position in an ordering that no longer applies.
      expect(decodeCursor(encodeCursor(CURSOR), 'popular')).toBeNull();
    });

    it.each([
      ['not base64 at all', 'this is not a cursor'],
      ['valid base64, not JSON', Buffer.from('nope').toString('base64url')],
      ['a non-uuid id', encodeCursor({ ...CURSOR, id: "1' OR 1=1--" })],
      [
        'a timestamp that is really SQL',
        encodeCursor({
          ...CURSOR,
          createdAt: "2026-01-01'; DROP TABLE gallery_items;--",
        }),
      ],
      [
        'a non-numeric sort key',
        encodeCursor({
          ...CURSOR,
          sortOrder: 'seven',
        } as unknown as GalleryCursor),
      ],
      ['an unknown sort', encodeCursor({ ...CURSOR, sort: 'random' as never })],
    ])('%s', (_label, value) => {
      expect(decodeCursor(value, 'order')).toBeNull();
    });

    it('treats a missing cursor as the start of the archive', () => {
      expect(decodeCursor(undefined, 'order')).toBeNull();
      expect(decodeCursor('', 'order')).toBeNull();
    });
  });

  describe('ordering', () => {
    it('always ends on the id, so the order is total', () => {
      // Without it, rows sharing a sortOrder (every admin-added shot defaults
      // to 0) have no defined order and Postgres may return them differently
      // on the very next request.
      for (const sort of ['order', 'newest', 'popular'] as const) {
        const keys = orderingFor(sort);
        expect(keys[keys.length - 1]).toEqual(['item.id', 'ASC']);
      }
    });

    it('reads the archive in sortOrder, then newest first', () => {
      expect(orderingFor('order')).toEqual([
        ['item.sortOrder', 'ASC'],
        ['item.createdAt', 'DESC'],
        ['item.id', 'ASC'],
      ]);
    });
  });

  describe('afterCursor', () => {
    it('compares every key the ordering uses', () => {
      const { clause, params } = afterCursor(CURSOR);
      expect(clause).toContain('"sortOrder"');
      expect(clause).toContain('"createdAt"');
      expect(clause).toContain('"id"');
      expect(params).toEqual({
        curSortOrder: 7,
        curCreatedAt: CURSOR.createdAt,
        curId: CURSOR.id,
      });
    });

    it('drops the sortOrder key under "newest", which does not use it', () => {
      const { clause, params } = afterCursor({ ...CURSOR, sort: 'newest' });
      expect(clause).not.toContain('"sortOrder"');
      expect(params.curSortOrder).toBeUndefined();
    });

    it('leads with likes under "popular"', () => {
      const { clause, params } = afterCursor({ ...CURSOR, sort: 'popular' });
      expect(clause.startsWith('(item."likeCount" <')).toBe(true);
      expect(params.curLikeCount).toBe(3);
    });

    it('binds values rather than pasting them into the SQL', () => {
      // The cursor arrives in a query string. Two of its fields end up in a
      // WHERE clause, and this is the line between a parameter and an
      // injection.
      const { clause } = afterCursor(CURSOR);
      expect(clause).not.toContain(CURSOR.id);
      expect(clause).not.toContain(CURSOR.createdAt);
    });
  });
});
