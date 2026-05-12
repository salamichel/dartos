// Points awarded based on final rank in a match.
// Tunable in one place. Any rank beyond the table gets 1 participation point.
const POINTS_BY_RANK: Record<number, number> = {
  1: 10,
  2: 6,
  3: 4,
  4: 2,
};
const DEFAULT_POINTS = 1;

export function pointsForRank(rank: number): number {
  return POINTS_BY_RANK[rank] ?? DEFAULT_POINTS;
}
