export type FinishType = "SIMPLE" | "DOUBLE" | "TRIPLE";

export interface MatchParticipantResult {
  playerId: number;
  rank: number;
  scoreLeft: number | null;
  xpBefore: number;
  xpEarned: number;
  finishType?: FinishType;
  medals: string[];
}

export interface XPConfig {
  xpPerDefeatedOpponent: number;
  xpBonusSimple: number;
  xpBonusDouble: number;
  xpBonusTriple: number;
  xpVampireMultiplier: number;
  xpSurvivorBase: number;
  xpBonusPoulidor: number;
  xpBonusJackpot: number;
  xpBonusEgalite: number;
  xpBonusTueurDeGeants: number;
  xpBonusPhenix: number;
  xpBonusSerialWinner: number;
  xpBonusBenjamin: number;
  bonusVainqueurParRang: boolean;
}

/**
 * Calculates XP and rank for all participants of a Sudden Death 301 match.
 */
export function calculateMatchResults(
  winnerId: number,
  finishType: FinishType,
  losers: { playerId: number; scoreLeft: number; level: number }[],
  winnerLevel: number,
  config: XPConfig,
  winnerXPBefore: number = 0,
  loserXPBefore: Map<number, number> = new Map(),
  winnerConsecutiveWinsBefore: number = 0
): MatchParticipantResult[] {
  const sortedLosers = [...losers].sort((a, b) => a.scoreLeft - b.scoreLeft);
  const nAdversaries = losers.length;
  const totalScoreLeft = losers.reduce((sum, l) => sum + l.scoreLeft, 0);

  // Winner XP
  let finishBonus = config.xpBonusSimple;
  if (finishType === "TRIPLE") finishBonus = config.xpBonusTriple;
  else if (finishType === "DOUBLE") finishBonus = config.xpBonusDouble;

  let xpFromLosers: number;
  if (config.bonusVainqueurParRang) {
    const winnerTier = getLevelIndex(winnerLevel);
    xpFromLosers = losers.reduce((sum, l) => {
      const tierDiff = Math.max(0, winnerTier - getLevelIndex(l.level));
      const factor = Math.max(0, 1 - 0.25 * tierDiff);
      return sum + Math.floor(config.xpPerDefeatedOpponent * factor);
    }, 0);
  } else {
    xpFromLosers = nAdversaries * config.xpPerDefeatedOpponent;
  }
  let winnerXP = xpFromLosers + finishBonus + (totalScoreLeft * config.xpVampireMultiplier);
  const winnerMedals: string[] = [];

  // Tueur de Géants: Winner level < any loser level
  if (losers.some(l => l.level > winnerLevel)) {
    winnerXP += config.xpBonusTueurDeGeants;
    winnerMedals.push("TUEUR_DE_GEANTS");
  }

  // Phenix: Winner had the strictly lowest XP among all participants
  if (config.xpBonusPhenix > 0 && losers.length > 0) {
    const minLoserXP = Math.min(...losers.map(l => loserXPBefore.get(l.playerId) ?? 0));
    if (winnerXPBefore < minLoserXP) {
      winnerXP += config.xpBonusPhenix;
      winnerMedals.push("PHENIX");
    }
  }

  // Serial Winner: 3rd consecutive win or more in this season
  if (config.xpBonusSerialWinner > 0 && winnerConsecutiveWinsBefore >= 2) {
    winnerXP += config.xpBonusSerialWinner;
    winnerMedals.push("SERIAL_WINNER");
  }

  const results: MatchParticipantResult[] = [];
  results.push({
    playerId: winnerId,
    rank: 1,
    scoreLeft: null,
    xpBefore: winnerXPBefore,
    xpEarned: winnerXP,
    finishType,
    medals: winnerMedals,
  });

  // Losers XP
  const scoreCounts = new Map<number, number>();
  losers.forEach(l => scoreCounts.set(l.scoreLeft, (scoreCounts.get(l.scoreLeft) || 0) + 1));

  sortedLosers.forEach((loser, index) => {
    const rank = index + 2;
    let xp = config.xpSurvivorBase;
    const medals: string[] = [];

    // Poulidor: rank 1 and score < 10
    if (rank > 1 && loser.scoreLeft < 10) {
      xp += config.xpBonusPoulidor;
      medals.push("POULIDOR");
    }

    // Jackpot: Palindrome
    if (isPalindrome(loser.scoreLeft)) {
      xp += config.xpBonusJackpot;
      medals.push("JACKPOT");
    }

    // Égalité Fraternelle
    if (scoreCounts.get(loser.scoreLeft)! > 1) {
      xp += config.xpBonusEgalite;
      medals.push("EGALITE");
    }

    // Benjamin: last-ranked loser (with 3+ losers) finishing close (< 50)
    if (
      config.xpBonusBenjamin > 0 &&
      sortedLosers.length >= 3 &&
      rank === sortedLosers.length + 1 &&
      loser.scoreLeft < 50
    ) {
      xp += config.xpBonusBenjamin;
      medals.push("BENJAMIN");
    }

    results.push({
      playerId: loser.playerId,
      rank,
      scoreLeft: loser.scoreLeft,
      xpBefore: loserXPBefore.get(loser.playerId) ?? 0,
      xpEarned: xp,
      medals,
    });
  });

  return results;
}

function isPalindrome(n: number): boolean {
  if (n < 10) return false;
  const s = String(n);
  return s === s.split("").reverse().join("");
}

export const LEVELS = [
  { title: "Pousse-Caillou", minXP: 0 },
  { title: "Lanceur du Dimanche", minXP: 500 },
  { title: "Sniper de Comptoir", minXP: 2000 },
  { title: "Maître du 301", minXP: 5000 },
  { title: "Phil Taylor", minXP: 10000 },
];

function getLevelIndex(xp: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return i;
  }
  return 0;
}

export function getLevel(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}
