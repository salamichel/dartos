export type FinishType = "SIMPLE" | "DOUBLE" | "TRIPLE";

export interface MatchParticipantResult {
  playerId: number;
  rank: number;
  scoreLeft: number | null;
  xpEarned: number;
  finishType?: FinishType;
}

/**
 * Calculates XP and rank for all participants of a Sudden Death 301 match.
 */
export function calculateMatchResults(
  winnerId: number,
  finishType: FinishType,
  losers: { playerId: number; scoreLeft: number }[]
): MatchParticipantResult[] {
  // Sort losers by scoreLeft ascending to determine rank (2nd, 3rd, ...)
  const sortedLosers = [...losers].sort((a, b) => a.scoreLeft - b.scoreLeft);
  const nAdversaries = losers.length;
  const totalScoreLeft = losers.reduce((sum, l) => sum + l.scoreLeft, 0);

  // Winner XP:
  // 1. Bataille Royale: +50 XP per defeated opponent
  // 2. Panache: Simple = 0 | Double = +50 | Triple/Bulle = +100
  // 3. Vampire de Zone: +1 XP per remaining point on board
  const finishBonus = finishType === "TRIPLE" ? 100 : finishType === "DOUBLE" ? 50 : 0;
  const winnerXP = (nAdversaries * 50) + finishBonus + totalScoreLeft;

  const results: MatchParticipantResult[] = [];
  results.push({
    playerId: winnerId,
    rank: 1,
    scoreLeft: null,
    xpEarned: winnerXP,
    finishType,
  });

  // Losers XP:
  // 1. Consolation: +20 XP base
  // 2. Cul Rouge (last): +20 XP - (scoreLeft / 2)
  sortedLosers.forEach((loser, index) => {
    const rank = index + 2;
    const isCulRouge = index === sortedLosers.length - 1;
    let xp = 20;
    if (isCulRouge) {
      xp -= Math.round(loser.scoreLeft / 2);
    }
    results.push({
      playerId: loser.playerId,
      rank,
      scoreLeft: loser.scoreLeft,
      xpEarned: xp,
    });
  });

  return results;
}

export const LEVELS = [
  { title: "Pousse-Caillou", minXP: 0 },
  { title: "Lanceur du Dimanche", minXP: 500 },
  { title: "Sniper de Comptoir", minXP: 2000 },
  { title: "Maître du 301", minXP: 5000 },
  { title: "Phil Taylor", minXP: 10000 },
];

export function getLevel(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}
