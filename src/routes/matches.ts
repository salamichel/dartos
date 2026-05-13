import { Router } from "express";
import { prisma } from "../db";
import { recordMatchSchema } from "../schemas";
import { calculateMatchResults, FinishType } from "../scoring";

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
  foundPlayers.forEach(p => {
    const totalXP = p.participations.reduce((sum, part) => sum + part.xpEarned, 0);
    playerLevels.set(p.id, Math.max(0, totalXP));
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
  };

  const results = calculateMatchResults(
    winner.playerId,
    winner.finishType as FinishType,
    losers.map(l => ({ ...l, level: playerLevels.get(l.playerId) || 0 })),
    playerLevels.get(winner.playerId) || 0,
    config
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

matchesRouter.put("/:id", async (req, res) => {
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
  foundPlayers.forEach(p => {
    const totalXP = p.participations.reduce((sum, part) => sum + part.xpEarned, 0);
    playerLevels.set(p.id, Math.max(0, totalXP));
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
  };

  const results = calculateMatchResults(
    winner.playerId,
    winner.finishType as FinishType,
    losers.map(l => ({ ...l, level: playerLevels.get(l.playerId) || 0 })),
    playerLevels.get(winner.playerId) || 0,
    config
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
