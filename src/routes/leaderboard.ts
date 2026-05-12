import { Router } from "express";
import { prisma } from "../db";
import { getLevel } from "../scoring";

export const leaderboardRouter = Router();

leaderboardRouter.get("/", async (req, res) => {
  const players = await prisma.player.findMany({
    include: {
      participations: {
        select: {
          xpEarned: true,
        },
      },
    },
  });

  const leaderboard = players.map((player) => {
    const totalXP = player.participations.reduce((sum, p) => sum + p.xpEarned, 0);
    const clampedXP = Math.max(0, totalXP);
    const matchCount = player.participations.length;
    const xpPerMatch = matchCount > 0 ? (clampedXP / matchCount).toFixed(2) : "0.00";
    const levelInfo = getLevel(clampedXP);

    return {
      id: player.id,
      name: player.name,
      totalXP: clampedXP,
      matchCount,
      xpPerMatch: parseFloat(xpPerMatch),
      level: levelInfo.title,
    };
  });

  // Sort by total XP descending
  leaderboard.sort((a, b) => b.totalXP - a.totalXP);

  res.json(leaderboard);
});
