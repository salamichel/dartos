export type FinishType = "SIMPLE" | "DOUBLE" | "TRIPLE";

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
  xpBonusLottery: number;
  bonusVainqueurParRang: boolean;
}

export interface Player {
  id: number;
  name: string;
  createdAt: string;
}

export interface Season extends XPConfig {
  id: number;
  name: string;
  startedAt: string;
  endedAt: string | null;
}

export interface MatchParticipant {
  playerId: number;
  rank: number;
  scoreLeft: number | null; // null for winner
  xpBefore: number;
  xpEarned: number;
  xpBonusLotteryEarned?: number; // New for slot machine gains tracking
  finishType?: FinishType; // winner only
  medals: string[];
}

export interface Match {
  id: number;
  seasonId: number;
  playedAt: string;
  participants: MatchParticipant[];
}

export interface Guild {
  id: number;
  name: string;
  badgeIcon: string;
  badgeColor: string;
  createdAt: string;
  memberIds: number[]; // lists player ids
}

export interface GuildMemberWithStats {
  id: number;
  name: string;
  totalXP: number;
  totalBadgesCount: number;
  totalWins: number;
  guildRank: string;
  guildRankIcon: string;
  guildRankSlug: string;
}

export interface GuildAchievement {
  id: string;
  title: string;
  icon: string;
  description: string;
  unlocked: boolean;
}

export interface GuildWithStats {
  id: number;
  name: string;
  badgeIcon: string;
  badgeColor: string;
  createdAt: string;
  members: GuildMemberWithStats[];
  memberCount: number;
  collectiveXP: number;
  collectiveWins: number;
  achievements: GuildAchievement[];
}
