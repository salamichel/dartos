import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { createSeasonSchema, updateSeasonSchema } from "../schemas";
import { calculateMatchResults } from "../scoring";
import { requireAdminPassword } from "../middleware";

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
// Computes total XP and average XP per match for every player who
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
    totalXP: number;
    wins: number;
  };
  const byPlayer = new Map<number, Agg>();

  for (const p of participations) {
    const entry =
      byPlayer.get(p.playerId) ?? {
        playerId: p.playerId,
        playerName: p.player.name,
        matchesPlayed: 0,
        totalXP: 0,
        wins: 0,
      };
    entry.matchesPlayed += 1;
    entry.totalXP += p.xpEarned;
    if (p.rank === 1) entry.wins += 1;
    byPlayer.set(p.playerId, entry);
  }

  const leaderboard = Array.from(byPlayer.values())
    .map((e) => {
      // Clamping season total XP at 0 as well for consistency
      const clampedXP = Math.max(0, e.totalXP);
      return {
        ...e,
        totalXP: clampedXP,
        averageXP: Number((clampedXP / e.matchesPlayed).toFixed(2)),
      };
    })
    .sort((a, b) => {
      if (b.totalXP !== a.totalXP) return b.totalXP - a.totalXP;
      if (b.averageXP !== a.averageXP) return b.averageXP - a.averageXP;
      return b.wins - a.wins;
    })
    .map((e, i) => ({ position: i + 1, ...e }));

  res.json({ seasonId, seasonName: season.name, leaderboard });
});

seasonsRouter.patch("/:id", requireAdminPassword, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid season id" });
  }
  const parsed = updateSeasonSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const season = await prisma.season.findUnique({
    where: { id },
    include: { matches: { include: { participants: true } } },
  });
  if (!season) return res.status(404).json({ error: "Season not found" });

  const updated = await prisma.season.update({ where: { id }, data: parsed.data });

  // Fetch player levels for accurate TUEUR_DE_GEANTS calculation
  const patchAllPlayerIds = [...new Set(season.matches.flatMap(m => m.participants.map(p => p.playerId)))];
  const patchPlayers = await prisma.player.findMany({
    where: { id: { in: patchAllPlayerIds } },
    include: { participations: { select: { xpEarned: true } } },
  });
  const patchPlayerLevels = new Map<number, number>();
  patchPlayers.forEach(p => {
    const totalXP = p.participations.reduce((sum, part) => sum + part.xpEarned, 0);
    patchPlayerLevels.set(p.id, Math.max(0, totalXP));
  });

  // Recalculate XP for all matches with the new rules
  await prisma.$transaction(async (tx) => {
    for (const match of season.matches) {
      const winnerPart = match.participants.find((p) => p.rank === 1);
      const losers = match.participants
        .filter((p) => p.rank > 1)
        .map((p) => ({ playerId: p.playerId, scoreLeft: p.scoreLeft ?? 0 }));
      if (!winnerPart) continue;

      const newScores = calculateMatchResults(
        winnerPart.playerId,
        winnerPart.finishType as any,
        losers.map((l) => ({ ...l, level: patchPlayerLevels.get(l.playerId) ?? 0 })),
        patchPlayerLevels.get(winnerPart.playerId) ?? 0,
        {
          xpPerDefeatedOpponent: updated.xpPerDefeatedOpponent,
          xpBonusSimple: updated.xpBonusSimple,
          xpBonusDouble: updated.xpBonusDouble,
          xpBonusTriple: updated.xpBonusTriple,
          xpVampireMultiplier: updated.xpVampireMultiplier,
          xpSurvivorBase: updated.xpSurvivorBase,
          xpBonusPoulidor: updated.xpBonusPoulidor,
          xpBonusJackpot: updated.xpBonusJackpot,
          xpBonusEgalite: updated.xpBonusEgalite,
          xpBonusTueurDeGeants: updated.xpBonusTueurDeGeants,
        }
      );

      for (const ns of newScores) {
        await tx.matchParticipant.update({
          where: { matchId_playerId: { matchId: match.id, playerId: ns.playerId } },
          data: { xpEarned: ns.xpEarned, medals: ns.medals },
        });
      }
    }
  });

  return res.json({ ...updated, matchesRecalculated: season.matches.length });
});

seasonsRouter.delete("/:id", requireAdminPassword, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid season id" });
  }
  const season = await prisma.season.findUnique({ where: { id } });
  if (!season) return res.status(404).json({ error: "Season not found" });

  await prisma.season.delete({ where: { id } });
  return res.status(204).send();
});

seasonsRouter.post("/:id/recalculate", requireAdminPassword, async (req, res) => {
  const id = Number(req.params.id);
  const season = await prisma.season.findUnique({
    where: { id },
    include: {
      matches: {
        include: { participants: true },
      },
    },
  });
  if (!season) return res.status(404).json({ error: "Season not found" });

  const recalcAllPlayerIds = [...new Set(season.matches.flatMap(m => m.participants.map(p => p.playerId)))];
  const recalcPlayers = await prisma.player.findMany({
    where: { id: { in: recalcAllPlayerIds } },
    include: { participations: { select: { xpEarned: true } } },
  });
  const recalcPlayerLevels = new Map<number, number>();
  recalcPlayers.forEach(p => {
    const totalXP = p.participations.reduce((sum, part) => sum + part.xpEarned, 0);
    recalcPlayerLevels.set(p.id, Math.max(0, totalXP));
  });

  await prisma.$transaction(async (tx) => {
    for (const match of season.matches) {
      const winnerPart = match.participants.find((p) => p.rank === 1);
      const losers = match.participants
        .filter((p) => p.rank > 1)
        .map((p) => ({ playerId: p.playerId, scoreLeft: p.scoreLeft ?? 0 }));

      if (!winnerPart) continue;

      const newScores = calculateMatchResults(
        winnerPart.playerId,
        winnerPart.finishType as any,
        losers.map((l) => ({ ...l, level: recalcPlayerLevels.get(l.playerId) ?? 0 })),
        recalcPlayerLevels.get(winnerPart.playerId) ?? 0,
        {
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
        }
      );

      for (const ns of newScores) {
        await tx.matchParticipant.update({
          where: { matchId_playerId: { matchId: match.id, playerId: ns.playerId } },
          data: { 
            xpEarned: ns.xpEarned,
            medals: ns.medals,
          },
        });
      }
    }
  });

  res.json({ success: true, matchesProcessed: season.matches.length });
});
