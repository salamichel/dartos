import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { createPlayerSchema } from "../schemas";
import { getLevel } from "../scoring";


export const playersRouter = Router();

playersRouter.post("/", async (req, res) => {
  const parsed = createPlayerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const player = await prisma.player.create({ data: parsed.data });
    return res.status(201).json(player);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "A player with this name already exists" });
    }
    throw e;
  }
});

playersRouter.get("/", async (_req, res) => {
  const players = await prisma.player.findMany({
    include: {
      participations: {
        select: { xpEarned: true, medals: true }
      },
      guilds: {
        include: {
          guild: true
        }
      }
    },
    orderBy: { createdAt: "asc" } 
  });  

  const playersWithStats = players.map(p => {
    const totalXP = p.participations.reduce((sum, part) => sum + part.xpEarned, 0);
    const badges: Record<string, number> = {};
    for (const part of p.participations) {
      for (const m of part.medals) {
        badges[m] = (badges[m] ?? 0) + 1;
      }
    }
    const clampedXP = Math.max(0, totalXP);
    const totalBadgesCount = p.participations.reduce((sum, part) => sum + part.medals.length, 0);
    const uniqueMedals = Array.from(new Set(p.participations.flatMap(part => part.medals)));
    const levelInfo = getLevel(clampedXP);

    return {
      id: p.id,
      name: p.name,
      matchCount: p.participations.length,
      badges,
      totalXP: clampedXP,
      totalBadgesCount,
      uniqueMedals,
      level: levelInfo.title,
      guilds: p.guilds.map(pg => ({
        id: pg.guild.id,
        name: pg.guild.name,
        badgeIcon: pg.guild.badgeIcon,
        badgeColor: pg.guild.badgeColor
      }))
    };
  });

  res.json(playersWithStats);
});


playersRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = createPlayerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const player = await prisma.player.update({
      where: { id },
      data: parsed.data,
    });
    return res.json(player);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "A player with this name already exists" });
    }
    return res.status(404).json({ error: "Player not found" });
  }
});
