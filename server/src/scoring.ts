import { FinishType, XPConfig, MatchParticipant, Match, Player } from "./types";

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

export function getLevelIndex(xp: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return i;
  }
  return 0;
}

export function isPalindrome(n: number): boolean {
  if (n < 10) return false;
  const s = String(n);
  return s === s.split("").reverse().join("");
}

export const SEASON_DEFAULTS: XPConfig = {
  xpPerDefeatedOpponent: 50,
  xpBonusSimple: 0,
  xpBonusDouble: 50,
  xpBonusTriple: 100,
  xpVampireMultiplier: 1,
  xpSurvivorBase: 20,
  xpBonusPoulidor: 15,
  xpBonusJackpot: 20,
  xpBonusEgalite: 10,
  xpBonusTueurDeGeants: 50,
  xpBonusPhenix: 30,
  xpBonusSerialWinner: 40,
  xpBonusBenjamin: 15,
  xpBonusLottery: 20,
  bonusVainqueurParRang: false,
};

export const MEDALS_MAP: Record<string, string> = {
  POULIDOR: "🥈",
  JACKPOT: "🎰",
  EGALITE: "🤝",
  TUEUR_DE_GEANTS: "⚔️🏆",
  PHENIX: "🔥",
  SERIAL_WINNER: "🔥🔥",
  BENJAMIN: "🥉",
  LOTTERY_WINNER: "🍀",
};

export function getMedalIcon(m: string): string {
  if (m.startsWith("LOTTERY_WINNER:")) {
    const emoji = m.split(":")[1];
    return "🍀" + emoji;
  }
  return MEDALS_MAP[m] || m;
}

export function getMedalTitle(m: string): string {
  if (m.startsWith("LOTTERY_WINNER:")) {
    const emoji = m.split(":")[1];
    return `Gagnant Tombola (${emoji}) !`;
  }
  switch (m) {
    case "POULIDOR": return "Poulidor (Finit à < 10 pts)";
    case "JACKPOT": return "Jackpot (Score miroir)";
    case "EGALITE": return "Égalité Fraternelle";
    case "TUEUR_DE_GEANTS": return "Tueur de Géants (Bat un plus haut niveau)";
    case "PHENIX": return "Phénix (Outsider qui gagne)";
    case "SERIAL_WINNER": return "Serial Winner (3ème victoire d'affilée)";
    case "BENJAMIN": return "Benjamin (Dernier mais proche)";
    default: return m;
  }
}

/**
 * Calculates current season XP stats for players based on matches of this season
 */
export function getSeasonPlayerXPs(seasonId: number, matches: Match[]): Map<number, number> {
  const map = new Map<number, number>();
  const seasonMatches = matches.filter(m => m.seasonId === seasonId);
  // Sort matches chronologically to aggregate correctly
  const sorted = [...seasonMatches].sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());
  
  for (const m of sorted) {
    for (const p of m.participants) {
      const current = map.get(p.playerId) || 0;
      map.set(p.playerId, current + p.xpEarned);
    }
  }
  return map;
}

/**
 * Calculates career XP stats for players based on all matches
 */
export function getPlayersCareerXPs(matches: Match[]): Map<number, number> {
  const map = new Map<number, number>();
  const sorted = [...matches].sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());
  for (const m of sorted) {
    for (const p of m.participants) {
      const current = map.get(p.playerId) || 0;
      map.set(p.playerId, current + p.xpEarned);
    }
  }
  return map;
}

/**
 * Traces the number of consecutive matches won by a player just before a reference time
 */
export function countConsecutiveWinsBefore(
  playerId: number,
  seasonId: number,
  matches: Match[],
  beforeDateStr: string,
  excludeMatchId?: number
): number {
  const seasonMatches = matches.filter(m => m.seasonId === seasonId && m.id !== excludeMatchId);
  const beforeTime = new Date(beforeDateStr).getTime();
  
  // Get all previous matches for this player in this season, sorted newest to oldest
  const previousParticipants = seasonMatches
    .filter(m => new Date(m.playedAt).getTime() < beforeTime && m.participants.some(p => p.playerId === playerId))
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

  let count = 0;
  for (const m of previousParticipants) {
    const self = m.participants.find(p => p.playerId === playerId);
    if (self && self.rank === 1) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Main game engine calculation: Sudden Death 301 match results
 */
export function calculateMatchResults(
  winnerId: number,
  finishType: FinishType,
  losers: { playerId: number; scoreLeft: number }[],
  winnerCareerXPBefore: number,
  loserCareerXPsBefore: Map<number, number>, // Map from PlayerId -> career XP before match
  config: XPConfig,
  winnerConsecutiveWinsBefore: number
): MatchParticipant[] {
  // Sort losers ascending by remaining score (closest to 0 ranks higher)
  const sortedLosers = [...losers].sort((a, b) => a.scoreLeft - b.scoreLeft);
  const nAdversaries = losers.length;
  const totalScoreLeft = losers.reduce((sum, l) => sum + l.scoreLeft, 0);

  // Winner XP from opponents
  let xpFromLosers = 0;
  if (config.bonusVainqueurParRang) {
    const winnerTier = getLevelIndex(winnerCareerXPBefore);
    xpFromLosers = losers.reduce((sum, l) => {
      const loserXP = loserCareerXPsBefore.get(l.playerId) || 0;
      const tierDiff = Math.max(0, winnerTier - getLevelIndex(loserXP));
      const factor = Math.max(0, 1 - 0.25 * tierDiff);
      return sum + Math.floor(config.xpPerDefeatedOpponent * factor);
    }, 0);
  } else {
    xpFromLosers = nAdversaries * config.xpPerDefeatedOpponent;
  }

  // Winner XP closing type bonus
  let finishBonus = config.xpBonusSimple;
  if (finishType === "TRIPLE") finishBonus = config.xpBonusTriple;
  else if (finishType === "DOUBLE") finishBonus = config.xpBonusDouble;

  // Vampire multiplier
  const vampireXP = totalScoreLeft * config.xpVampireMultiplier;

  let winnerXP = xpFromLosers + finishBonus + vampireXP;
  const winnerMedals: string[] = [];

  // 1. Tueur de Géants: Winner level < at least one loser level
  const winnerTier = getLevelIndex(winnerCareerXPBefore);
  const hasGiantOpponent = losers.some(l => {
    const opponentXP = loserCareerXPsBefore.get(l.playerId) || 0;
    return getLevelIndex(opponentXP) > winnerTier;
  });
  if (hasGiantOpponent) {
    winnerXP += config.xpBonusTueurDeGeants;
    winnerMedals.push("TUEUR_DE_GEANTS");
  }

  // 2. Phénix: Winner had strictly LESS starting XP than all other players
  const otherXPs = losers.map(l => loserCareerXPsBefore.get(l.playerId) || 0);
  if (otherXPs.length > 0 && winnerCareerXPBefore < Math.min(...otherXPs)) {
    winnerXP += config.xpBonusPhenix;
    winnerMedals.push("PHENIX");
  }

  // 3. Serial Winner: 3rd consecutive win or more in this season
  if (winnerConsecutiveWinsBefore >= 2) {
    winnerXP += config.xpBonusSerialWinner;
    winnerMedals.push("SERIAL_WINNER");
  }

  const results: MatchParticipant[] = [];
  results.push({
    playerId: winnerId,
    rank: 1,
    scoreLeft: null,
    xpBefore: winnerCareerXPBefore,
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

    // Poulidor: Rank 2 and score remaining < 10
    if (rank === 2 && loser.scoreLeft < 10) {
      xp += config.xpBonusPoulidor;
      medals.push("POULIDOR");
    }

    // Jackpot: Palindrome score left >= 10 (ex. 11, 22...)
    if (isPalindrome(loser.scoreLeft)) {
      xp += config.xpBonusJackpot;
      medals.push("JACKPOT");
    }

    // Égalité Fraternelle: same score left as another loser
    if ((scoreCounts.get(loser.scoreLeft) || 0) > 1) {
      xp += config.xpBonusEgalite;
      medals.push("EGALITE");
    }

    // Benjamin: last placed in a game with 3+ losers (4+ players) with scoreleft < 50
    const totalLosersInMatch = sortedLosers.length;
    if (
      totalLosersInMatch >= 2 && // 3+ players total
      rank === totalLosersInMatch + 1 && // last place
      loser.scoreLeft < 50
    ) {
      xp += config.xpBonusBenjamin;
      medals.push("BENJAMIN");
    }

    results.push({
      playerId: loser.playerId,
      rank,
      scoreLeft: loser.scoreLeft,
      xpBefore: loserCareerXPsBefore.get(loser.playerId) || 0,
      xpEarned: xp,
      medals,
    });
  });

  return results;
}

/**
 * 9-tier rank logic inside a Guild
 */
export function calculateGuildRank(
  totalXP: number,
  totalBadgesCount: number,
  uniqueBadges: string[],
  isHighestXP: boolean
) {
  if (isHighestXP && totalXP >= 10000 && totalBadgesCount >= 10) {
    return { title: "Divinité du Triple", icon: "👑✨", slug: "triple-deity" };
  }
  if (isHighestXP || (totalXP >= 10000 && totalBadgesCount >= 5)) {
    return { title: "Maître Suprême", icon: "👑", slug: "supreme-master" };
  }
  if (totalXP >= 5000 && uniqueBadges.includes("TUEUR_DE_GEANTS") && totalBadgesCount >= 8) {
    return { title: "Tueur de Dragons", icon: "🐉", slug: "dragon-slayer" };
  }
  if (totalXP >= 5000 || (uniqueBadges.includes("TUEUR_DE_GEANTS") && totalBadgesCount >= 4)) {
    return { title: "Champion d'Élite", icon: "⚔️", slug: "elite-champion" };
  }
  if (totalXP >= 3000 && totalBadgesCount >= 6) {
    return { title: "Vétéran Légendaire", icon: "🛡️🔥", slug: "legendary-veteran" };
  }
  if (totalXP >= 2000 || totalBadgesCount >= 3) {
    return { title: "Vétéran Couronné", icon: "🏰", slug: "crowned-veteran" };
  }
  if (totalXP >= 1000 || totalBadgesCount >= 2) {
    return { title: "Lanceur Initié", icon: "🎖️", slug: "initiated-thrower" };
  }
  if (totalXP >= 500 || totalBadgesCount >= 1) {
    return { title: "Écuyer de l'Arène", icon: "🏹", slug: "arena-squire" };
  }
  return { title: "Recrue", icon: "👤", slug: "recruit" };
}
