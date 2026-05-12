import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { createSeasonSchema } from "../schemas";
import { pointsForRank } from "../scoring";

export const seasonsRouter = Router();

seasonsRouter.post("/", async (req, res) => {
  const parsed = createSeasonSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const season = await prisma.season.create({ data: parsed.data });
    return res.status(201).json(season);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "A season with this name already exists" });
    }
    throw e;
  }
});

seasonsRouter.get("/", async (_req, res) => {
  const seasons = await prisma.season.findMany({ orderBy: { startedAt: "desc" } });
  res.json(seasons);
});

// GET /seasons/:id/leaderboard
// Computes total points and average points per match for every player who
// participated in at least one match of the season.
seasonsRouter.get("/:id/leaderboard", async (req, res) => {
  const seasonId = Number(req.params.id);
  if (!Number.isInteger(seasonId) || seasonId <= 0) {
    return res.status(400).json({ error: "Invalid season id" });
  }

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return res.status(404).json({ error: "Season not found" });

  const participations = await prisma.matchParticipant.findMany({
    where: { match: { seasonId } },
    include: { player: true },
  });

  type Agg = {
    playerId: number;
    playerName: string;
    matchesPlayed: number;
    totalPoints: number;
    wins: number;
  };
  const byPlayer = new Map<number, Agg>();

  for (const p of participations) {
    const entry =
      byPlayer.get(p.playerId) ?? {
        playerId: p.playerId,
        playerName: p.player.name,
        matchesPlayed: 0,
        totalPoints: 0,
        wins: 0,
      };
    entry.matchesPlayed += 1;
    entry.totalPoints += pointsForRank(p.rank);
    if (p.rank === 1) entry.wins += 1;
    byPlayer.set(p.playerId, entry);
  }

  const leaderboard = Array.from(byPlayer.values())
    .map((e) => ({
      ...e,
      averagePoints: Number((e.totalPoints / e.matchesPlayed).toFixed(3)),
    }))
    .sort((a, b) => {
      // Primary ranking metric is the average to avoid penalizing newcomers.
      if (b.averagePoints !== a.averagePoints) return b.averagePoints - a.averagePoints;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.wins - a.wins;
    })
    .map((e, i) => ({ position: i + 1, ...e }));

  res.json({ seasonId, seasonName: season.name, leaderboard });
});
