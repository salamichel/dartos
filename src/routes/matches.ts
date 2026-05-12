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
    select: { id: true },
  });
  if (foundPlayers.length !== allPlayerIds.length) {
    const found = new Set(foundPlayers.map((p) => p.id));
    const missing = allPlayerIds.filter((id) => !found.has(id));
    return res.status(400).json({ error: "Unknown player ids", missing });
  }

  const results = calculateMatchResults(winner.playerId, winner.finishType as FinishType, losers);

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
