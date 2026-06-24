/**
 * Minimal LexoRank-style fractional ranking for ordering rows (e.g. Kanban
 * cards) without renumbering siblings on every move. Ranks are base-36 strings
 * compared lexicographically: to place an item between two neighbours we compute
 * a string that sorts strictly between their ranks.
 *
 * Pure (no Prisma dependency) so both `@zenbuild/api` (reordering) and
 * `@zenbuild/jobs` (initial task creation) can share one implementation.
 */

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length; // 36
const MIN = DIGITS[0]; // "0"
const MAX = DIGITS[BASE - 1]; // "z"

function digit(ch: string): number {
  const i = DIGITS.indexOf(ch);
  return i < 0 ? 0 : i;
}

/**
 * Returns a rank string strictly between `before` and `after` (lexicographic
 * order). Pass `null` for an open end:
 *  - `rankBetween(null, null)` → a middle rank for an empty list.
 *  - `rankBetween(last, null)` → a rank after `last` (append).
 *  - `rankBetween(null, first)` → a rank before `first` (prepend).
 *
 * Throws if `before >= after`, which signals the caller passed neighbours in the
 * wrong order or with equal ranks (ranks must be unique within a list).
 */
export function rankBetween(before: string | null, after: string | null): string {
  const lo = before && before.length > 0 ? before : null;
  const hi = after && after.length > 0 ? after : null;

  if (lo !== null && hi !== null && lo >= hi) {
    throw new Error(`rankBetween: invalid bounds (${lo} >= ${hi})`);
  }

  let result = "";
  let i = 0;

  // Walk digit positions, carrying the lower/upper bound at each step until we
  // find room for a midpoint digit.
  for (;;) {
    const loDigit = lo && i < lo.length ? digit(lo[i]!) : 0;
    const hiDigit = hi && i < hi.length ? digit(hi[i]!) : BASE;

    if (loDigit === hiDigit) {
      // No gap at this position — copy the digit and descend.
      result += DIGITS[loDigit];
      i += 1;
      continue;
    }

    const mid = Math.floor((loDigit + hiDigit) / 2);
    if (mid !== loDigit) {
      // There is a digit strictly between the bounds here.
      result += DIGITS[mid];
      return result;
    }

    // Bounds are adjacent (e.g. lo="a", hi="b"): keep the lower digit and append
    // a midpoint at the next, finer position.
    result += DIGITS[loDigit];
    i += 1;
  }
}

/**
 * Generates `count` evenly spaced, ascending ranks for an initial bulk insert
 * (e.g. the first batch of generated tasks). Spacing leaves room for later
 * midpoint insertions between any two.
 */
export function initialRanks(count: number): string[] {
  if (count <= 0) return [];
  const ranks: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < count; i++) {
    const next = rankBetween(prev, null);
    ranks.push(next);
    prev = next;
  }
  return ranks;
}

export { MIN as RANK_MIN, MAX as RANK_MAX };
