import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { createGuildSchema, updateGuildSchema, addGuildMemberSchema } from "../schemas";
import { requireAdminPassword } from "../middleware";

export const guildsRouter = Router();

// 9-tier rank logic
export function calculateGuildRank(totalXP: number, totalBadgesCount: number, uniqueBadges: string[], isHighestXP: boolean) {
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

// GET /guilds - List all guilds
guildsRouter.get("/", async (_req, res) => {
  let currentSeason = await prisma.season.findFirst({
    where: { endedAt: null },
    orderBy: { startedAt: "desc" },
  });

  if (!currentSeason) {
    currentSeason = await prisma.season.findFirst({
      orderBy: { startedAt: "desc" },
    });
  }

  if (!currentSeason) {
    return res.status(200).json([]);
  }

  const currentSeasonId = currentSeason.id;
  const guilds = await prisma.guild.findMany({
    include: {
      members: {
        include: {
          player: {
            include: {
              participations: {
                where: {
                  match: {
                    seasonId: currentSeasonId,
                  },
                },
                select: {
                  xpEarned: true,
                  medals: true,
                  rank: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formatted = guilds.map((guild) => {
    // 1. Calculate each member's individual statistics
    const membersWithStats = guild.members.map((m) => {
      const totalXP = m.player.participations.reduce((sum, p) => sum + p.xpEarned, 0);
      const clampedXP = Math.max(0, totalXP);
      const totalBadgesCount = m.player.participations.reduce((sum, p) => sum + p.medals.length, 0);
      const uniqueBadges = Array.from(new Set(m.player.participations.flatMap((p) => p.medals)));
      const totalWins = m.player.participations.filter((p) => p.rank === 1).length;

      return {
        id: m.player.id,
        name: m.player.name,
        totalXP: clampedXP,
        totalBadgesCount,
        uniqueBadges,
        totalWins,
        joinedAt: m.joinedAt,
      };
    });

    // 2. Find the highest XP in the guild to award Maître Suprême / Divinité
    const activeXPValues = membersWithStats.map((m) => m.totalXP);
    const maxXP = activeXPValues.length > 0 ? Math.max(...activeXPValues) : 0;

    // 3. Assign 9-tier dynamic rank to each member and sort them
    const sortedMembers = membersWithStats
      .map((m) => {
        const isHighestXP = m.totalXP === maxXP && maxXP > 0;
        const rankInfo = calculateGuildRank(m.totalXP, m.totalBadgesCount, m.uniqueBadges, isHighestXP);
        return {
          id: m.id,
          name: m.name,
          totalXP: m.totalXP,
          totalBadgesCount: m.totalBadgesCount,
          totalWins: m.totalWins,
          guildRank: rankInfo.title,
          guildRankIcon: rankInfo.icon,
          guildRankSlug: rankInfo.slug,
          joinedAt: m.joinedAt,
        };
      })
      .sort((a, b) => {
        // High XP first
        return b.totalXP - a.totalXP;
      });

    // 4. Calculate dynamic collective guild achievements (badges)
    const collectiveXP = sortedMembers.reduce((sum, m) => sum + m.totalXP, 0);
    const collectiveWins = sortedMembers.reduce((sum, m) => sum + m.totalWins, 0);
    const hasGiantMember = sortedMembers.some((m) => m.totalXP >= 5000);

    const achievements = [];
    if (collectiveXP >= 500) {
      achievements.push({ id: "apprentices", title: "Apprentis de la Fléchette", icon: "🥉", description: "XP collective >= 500 XP" });
    }
    if (collectiveXP >= 2000) {
      achievements.push({ id: "champions", title: "Champions en Devenir", icon: "🥈", description: "XP collective >= 2 000 XP" });
    }
    if (collectiveXP >= 10000) {
      achievements.push({ id: "legends", title: "Légendes Vivantes", icon: "🥇", description: "XP collective >= 10 000 XP" });
    }
    if (collectiveWins >= 10) {
      achievements.push({ id: "conquerors", title: "Conquérants", icon: "⚔️", description: "Total victoires >= 10" });
    }
    if (hasGiantMember) {
      achievements.push({ id: "giants-den", title: "Tanière des Géants", icon: "🐉", description: "Au moins un membre de niveau Maître" });
    }

    return {
      id: guild.id,
      name: guild.name,
      badgeIcon: guild.badgeIcon,
      badgeColor: guild.badgeColor,
      createdAt: guild.createdAt,
      members: sortedMembers,
      memberCount: sortedMembers.length,
      collectiveXP,
      collectiveWins,
      achievements,
    };
  });

  const sortedGuilds = formatted.sort((a, b) => b.collectiveXP - a.collectiveXP);
  res.json(sortedGuilds);
});

// POST /guilds - Create a new guild
guildsRouter.post("/", async (req, res) => {
  const parsed = createGuildSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const guild = await prisma.guild.create({ data: parsed.data });
    return res.status(201).json(guild);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "Une guilde avec ce nom existe déjà" });
    }
    throw e;
  }
});

// PATCH /guilds/:id - Update guild details (Admin Protected)
guildsRouter.patch("/:id", requireAdminPassword, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID de guilde invalide" });
  }
  const parsed = updateGuildSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const guild = await prisma.guild.update({
      where: { id },
      data: parsed.data,
    });
    return res.json(guild);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "Une guilde avec ce nom existe déjà" });
    }
    return res.status(404).json({ error: "Guilde introuvable" });
  }
});

// DELETE /guilds/:id - Delete a guild (Admin Protected)
guildsRouter.delete("/:id", requireAdminPassword, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID de guilde invalide" });
  }
  try {
    await prisma.guild.delete({ where: { id } });
    return res.status(204).send();
  } catch (e) {
    return res.status(404).json({ error: "Guilde introuvable" });
  }
});

// POST /guilds/:id/members - Add member to guild
guildsRouter.post("/:id/members", async (req, res) => {
  const guildId = Number(req.params.id);
  if (!Number.isInteger(guildId) || guildId <= 0) {
    return res.status(400).json({ error: "ID de guilde invalide" });
  }
  const parsed = addGuildMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const playerId = parsed.data.playerId;

  try {
    // Check if player already in the guild
    const exists = await prisma.playerGuild.findUnique({
      where: { playerId_guildId: { playerId, guildId } },
    });
    if (exists) {
      return res.status(409).json({ error: "Ce joueur fait déjà partie de cette guilde" });
    }

    const member = await prisma.playerGuild.create({
      data: { playerId, guildId },
      include: { player: true },
    });

    return res.status(201).json(member);
  } catch (e) {
    return res.status(404).json({ error: "Joueur ou guilde introuvable" });
  }
});

// DELETE /guilds/:id/members/:playerId - Exclude member from guild
guildsRouter.delete("/:id/members/:playerId", async (req, res) => {
  const guildId = Number(req.params.id);
  const playerId = Number(req.params.playerId);
  if (!Number.isInteger(guildId) || guildId <= 0 || !Number.isInteger(playerId) || playerId <= 0) {
    return res.status(400).json({ error: "IDs invalides" });
  }

  try {
    await prisma.playerGuild.delete({
      where: { playerId_guildId: { playerId, guildId } },
    });
    return res.status(204).send();
  } catch (e) {
    return res.status(404).json({ error: "Appartenance introuvable" });
  }
});
