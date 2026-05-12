import { Router } from "express";
import { prisma } from "../db";
import { recordMatchSchema } from "../schemas";

export const matchesRouter = Router();

// POST /matches — record a finished match.
matchesRouter.post("/", async (req, res) => {
  const parsed = recordMatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { seasonId, playedAt, participants } = parsed.data;

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return res.status(404).json({ error: "Season not found" });
  if (season.endedAt && season.endedAt <= new Date()) {
    return res.status(409).json({ error: "Season is closed" });
  }

  const playerIds = participants.map((p) => p.playerId);
  const foundPlayers = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true },
  });
  if (foundPlayers.length !== playerIds.length) {
    const found = new Set(foundPlayers.map((p) => p.id));
    const missing = playerIds.filter((id) => !found.has(id));
    return res.status(400).json({ error: "Unknown player ids", missing });
  }

  const match = await prisma.match.create({
    data: {
      seasonId,
      playedAt: playedAt ?? new Date(),
      participants: {
        create: participants.map((p) => ({
          playerId: p.playerId,
          rank: p.rank,
          scoreLeft: p.scoreLeft ?? null,
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
