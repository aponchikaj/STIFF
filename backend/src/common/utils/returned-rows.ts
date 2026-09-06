/**
 * The rows a raw `RETURNING` query actually produced.
 *
 * `EntityManager.query` does not hand back one shape. TypeORM's Postgres
 * driver special-cases `UPDATE` and `DELETE` and returns the pair
 * `[rows, rowCount]`; every other statement returns the row array on its own.
 * Both are arrays, so `result.length` answers "which shape is this?" and never
 * "how many rows matched" — a `WHERE stock >= $2` that held nothing back still
 * reads as length 2.
 *
 * That is not hypothetical: it is how the shop's oversell guard came to be
 * dead code. This function is the only place either shape is interpreted, so
 * a caller can ask the question it actually means to ask.
 *
 * The two are told apart by the first element: the pair's is the row array,
 * and a `RETURNING` row is always an object, never an array.
 */
export function returnedRows(result: unknown): unknown[] {
  if (!Array.isArray(result)) return [];
  const [first] = result as unknown[];
  return Array.isArray(first) ? first : result;
}

/** How many rows a raw `RETURNING` query touched. Zero when it matched none. */
export function rowsAffected(result: unknown): number {
  return returnedRows(result).length;
}
