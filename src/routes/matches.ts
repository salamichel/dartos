import { Router } from "express";
import { prisma } from "../db";
import { recordMatchSchema } from "../schemas";
import { calculateMatchResults, FinishType } from "../scoring";
import { requireAdminPassword } from "../middleware";

async function countConsecutiveWinsBefore(
  playerId: number,
  seasonId: number,
  beforeDate: Date,
  excludeMatchId?: number
): Promise<number> {
  const previousParticipations = await prisma.matchParticipant.findMany({
    where: {
      playerId,
      match: { seasonId, playedAt: { lt: beforeDate } },
      ...(excludeMatchId !== undefined ? { matchId: { not: excludeMatchId } } : {}),
    },
    include: { match: { select: { playedAt: true } } },
    orderBy: { match: { playedAt: "desc" } },
  });
  let count = 0;
  for (const p of previousParticipations) {
    if (p.rank === 1) count++;
    else break;
  }
  return count;
}

export const matchesRouter = Router();

// POST /matches — record a finished match.
matchesRouter.post("/", async (req, res) => {
  const parsed = recordMatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { seasonId, playedAt, winner, losers } = parsed.data;

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return res.status(404).json({ error: "Season not found" });
  if (season.endedAt && season.endedAt <= new Date()) {
    return res.status(409).json({ error: "Season is closed" });
  }

  const allPlayerIds = [winner.playerId, ...losers.map(l => l.playerId)];
  const foundPlayers = await prisma.player.findMany({
    where: { id: { in: allPlayerIds } },
    include: { participations: { select: { xpEarned: true } } },
  });
  if (foundPlayers.length !== allPlayerIds.length) {
    return res.status(400).json({ error: "Unknown player ids" });
  }

  const playerLevels = new Map<number, number>();
  const playerXPBefore = new Map<number, number>();
  foundPlayers.forEach(p => {
    const totalXP = p.participations.reduce((sum, part) => sum + part.xpEarned, 0);
    const clampedXP = Math.max(0, totalXP);
    playerLevels.set(p.id, clampedXP);
    playerXPBefore.set(p.id, clampedXP);
  });

  const config = {
    xpPerDefeatedOpponent: season.xpPerDefeatedOpponent,
    xpBonusSimple: season.xpBonusSimple,
    xpBonusDouble: season.xpBonusDouble,
    xpBonusTriple: season.xpBonusTriple,
    xpVampireMultiplier: season.xpVampireMultiplier,
    xpSurvivorBase: season.xpSurvivorBase,
    xpBonusPoulidor: season.xpBonusPoulidor,
    xpBonusJackpot: season.xpBonusJackpot,
    xpBonusEgalite: season.xpBonusEgalite,
    xpBonusTueurDeGeants: season.xpBonusTueurDeGeants,
    xpBonusPhenix: season.xpBonusPhenix,
    xpBonusSerialWinner: season.xpBonusSerialWinner,
    xpBonusBenjamin: season.xpBonusBenjamin,
    bonusVainqueurParRang: season.bonusVainqueurParRang,
  };

  const loserXPBeforeMap = new Map<number, number>();
  losers.forEach(l => {
    loserXPBeforeMap.set(l.playerId, playerXPBefore.get(l.playerId) || 0);
  });

  const winnerConsecutiveWinsBefore = await countConsecutiveWinsBefore(
    winner.playerId,
    seasonId,
    playedAt ?? new Date()
  );

  const results = calculateMatchResults(
    winner.playerId,
    winner.finishType as FinishType,
    losers.map(l => ({ ...l, level: playerLevels.get(l.playerId) || 0 })),
    playerLevels.get(winner.playerId) || 0,
    config,
    playerXPBefore.get(winner.playerId) || 0,
    loserXPBeforeMap,
    winnerConsecutiveWinsBefore
  );

  const match = await prisma.match.create({
    data: {
      seasonId,
      playedAt: playedAt ?? new Date(),
      participants: {
        create: results.map((r) => ({
          playerId: r.playerId,
          rank: r.rank,
          scoreLeft: r.scoreLeft,
          xpBefore: r.xpBefore,
          xpEarned: r.xpEarned,
          finishType: r.finishType,
          medals: r.medals,
        })),
      },
    },
    include: { participants: { include: { player: true } } },
  });

  res.status(201).json(match);
});

matchesRouter.get("/", async (req, res) => {
  const seasonId = req.query.seasonId ? Number(req.query.seasonId) : undefined;
  const matches = await prisma.match.findMany({
    where: seasonId ? { seasonId } : undefined,
    include: { participants: { include: { player: true } } },
    orderBy: { playedAt: "desc" },
  });
  res.json(matches);
});

matchesRouter.delete("/:id", requireAdminPassword, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid match id" });
  }
  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) return res.status(404).json({ error: "Match not found" });

  await prisma.match.delete({ where: { id } });
  return res.status(204).send();
});

matchesRouter.put("/:id", requireAdminPassword, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = recordMatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { seasonId, playedAt, winner, losers } = parsed.data;

  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) return res.status(404).json({ error: "Match not found" });

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return res.status(404).json({ error: "Season not found" });

  const allPlayerIds = [winner.playerId, ...losers.map(l => l.playerId)];
  const foundPlayers = await prisma.player.findMany({
    where: { id: { in: allPlayerIds } },
    include: { participations: { select: { xpEarned: true } } },
  });

  const playerLevels = new Map<number, number>();
  const playerXPBefore = new Map<number, number>();
  foundPlayers.forEach(p => {
    const totalXP = p.participations.reduce((sum, part) => sum + part.xpEarned, 0);
    const clampedXP = Math.max(0, totalXP);
    playerLevels.set(p.id, clampedXP);
    playerXPBefore.set(p.id, clampedXP);
  });

  const config = {
    xpPerDefeatedOpponent: season.xpPerDefeatedOpponent,
    xpBonusSimple: season.xpBonusSimple,
    xpBonusDouble: season.xpBonusDouble,
    xpBonusTriple: season.xpBonusTriple,
    xpVampireMultiplier: season.xpVampireMultiplier,
    xpSurvivorBase: season.xpSurvivorBase,
    xpBonusPoulidor: season.xpBonusPoulidor,
    xpBonusJackpot: season.xpBonusJackpot,
    xpBonusEgalite: season.xpBonusEgalite,
    xpBonusTueurDeGeants: season.xpBonusTueurDeGeants,
    xpBonusPhenix: season.xpBonusPhenix,
    xpBonusSerialWinner: season.xpBonusSerialWinner,
    xpBonusBenjamin: season.xpBonusBenjamin,
    bonusVainqueurParRang: season.bonusVainqueurParRang,
  };

  const loserXPBeforeMap = new Map<number, number>();
  losers.forEach(l => {
    loserXPBeforeMap.set(l.playerId, playerXPBefore.get(l.playerId) || 0);
  });

  const winnerConsecutiveWinsBefore = await countConsecutiveWinsBefore(
    winner.playerId,
    seasonId,
    playedAt ?? match.playedAt,
    id
  );

  const results = calculateMatchResults(
    winner.playerId,
    winner.finishType as FinishType,
    losers.map(l => ({ ...l, level: playerLevels.get(l.playerId) || 0 })),
    playerLevels.get(winner.playerId) || 0,
    config,
    playerXPBefore.get(winner.playerId) || 0,
    loserXPBeforeMap,
    winnerConsecutiveWinsBefore
  );

  const updatedMatch = await prisma.$transaction(async (tx) => {
    await tx.matchParticipant.deleteMany({ where: { matchId: id } });
    return tx.match.update({
      where: { id },
      data: {
        seasonId,
        playedAt: playedAt ?? match.playedAt,
        participants: {
          create: results.map((r) => ({
            playerId: r.playerId,
            rank: r.rank,
            scoreLeft: r.scoreLeft,
            xpBefore: r.xpBefore,
            xpEarned: r.xpEarned,
            finishType: r.finishType,
            medals: r.medals,
          })),
        },
      },
      include: { participants: { include: { player: true } } },
    });
  });

  res.json(updatedMatch);
});
