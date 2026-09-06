import { returnedRows, rowsAffected } from './returned-rows';

describe('returnedRows', () => {
  describe("the Postgres driver's UPDATE/DELETE pair", () => {
    it('unwraps the rows out of [rows, rowCount]', () => {
      expect(returnedRows([[{ id: 'a' }, { id: 'b' }], 2])).toEqual([
        { id: 'a' },
        { id: 'b' },
      ]);
    });

    /**
     * The case the whole module exists for. Both this and a matched row give
     * an array of length 2, so the pair has to be unwrapped before anything
     * can be counted.
     */
    it('reports nothing when the statement matched no row', () => {
      expect(returnedRows([[], 0])).toEqual([]);
      expect(rowsAffected([[], 0])).toBe(0);
    });
  });

  describe('a plain row array', () => {
    it('is passed through untouched', () => {
      expect(returnedRows([{ id: 'a' }])).toEqual([{ id: 'a' }]);
      expect(rowsAffected([{ id: 'a' }])).toBe(1);
    });

    it('is empty when nothing was returned', () => {
      expect(rowsAffected([])).toBe(0);
    });
  });

  /** Anything unrecognised counts as zero, so callers fail closed. */
  it('treats a non-array as no rows', () => {
    expect(rowsAffected(undefined)).toBe(0);
    expect(rowsAffected(null)).toBe(0);
    expect(rowsAffected({ rowCount: 1 })).toBe(0);
    expect(rowsAffected('1')).toBe(0);
  });
});
