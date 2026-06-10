import { PrismaClient } from "@prisma/client";
import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import * as path from "path";

// Charger les variables d'environnement
dotenv.config();

const prisma = new PrismaClient();

// Initialiser Firebase Admin
// Il faut soit spécifier FIREBASE_SERVICE_ACCOUNT_KEY (chemin vers le fichier JSON)
// soit utiliser les variables d'environnement standard de Firebase ou laisser Firebase s'initialiser automatiquement si configuré sur GCP
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountPath) {
  console.error("Erreur : La variable d'environnement FIREBASE_SERVICE_ACCOUNT_KEY n'est pas définie.");
  console.error("Veuillez créer un compte de service Firebase et renseigner son chemin dans le fichier .env");
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(path.resolve(serviceAccountPath)),
  });
} catch (error) {
  console.error("Erreur d'initialisation de Firebase Admin :", error);
  process.exit(1);
}

const db = admin.firestore();

async function migrate() {
  console.log("Début de la migration de PostgreSQL (Prisma) vers Firebase Firestore...");

  // 1. Migrer les Saisons (Seasons)
  console.log("Migration des saisons...");
  const seasons = await prisma.season.findMany();
  for (const season of seasons) {
    const seasonData = {
      name: season.name,
      startedAt: season.startedAt.toISOString(),
      endedAt: season.endedAt ? season.endedAt.toISOString() : null,
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
      xpBonusLottery: season.xpBonusLottery,
      bonusVainqueurParRang: season.bonusVainqueurParRang,
    };
    await db.collection("seasons").doc(season.id.toString()).set(seasonData);
  }
  console.log(`${seasons.length} saisons migrées.`);

  // 2. Migrer les Guildes (Guilds)
  console.log("Migration des guildes...");
  const guilds = await prisma.guild.findMany();
  for (const guild of guilds) {
    const guildData = {
      name: guild.name,
      badgeIcon: guild.badgeIcon,
      badgeColor: guild.badgeColor,
      createdAt: guild.createdAt.toISOString(),
    };
    await db.collection("guilds").doc(guild.id.toString()).set(guildData);
  }
  console.log(`${guilds.length} guildes migrées.`);

  // 3. Migrer les Joueurs (Players) et leurs liaisons de Guildes
  console.log("Migration des joueurs...");
  const players = await prisma.player.findMany({
    include: {
      guilds: true,
    },
  });
  for (const player of players) {
    const playerData = {
      name: player.name,
      createdAt: player.createdAt.toISOString(),
      guilds: player.guilds.map((pg: { guildId: number; joinedAt: Date }) => ({
        guildId: pg.guildId.toString(),
        joinedAt: pg.joinedAt.toISOString(),
      })),
    };
    await db.collection("players").doc(player.id.toString()).set(playerData);
  }
  console.log(`${players.length} joueurs migrés.`);

  // 4. Migrer les Matchs (Matches) et MatchParticipants
  console.log("Migration des matchs et participations...");
  const matches = await prisma.match.findMany({
    include: {
      participants: true,
    },
  });

  for (const match of matches) {
    const matchData = {
      seasonId: match.seasonId.toString(),
      playedAt: match.playedAt.toISOString(),
      participants: match.participants.map((p: {
        playerId: number;
        rank: number;
        scoreLeft: number | null;
        xpBefore: number;
        xpEarned: number;
        xpBonusLotteryEarned: number;
        finishType: string | null;
        medals: string[];
      }) => ({
        playerId: p.playerId.toString(),
        rank: p.rank,
        scoreLeft: p.scoreLeft,
        xpBefore: p.xpBefore,
        xpEarned: p.xpEarned,
        xpBonusLotteryEarned: p.xpBonusLotteryEarned,
        finishType: p.finishType,
        medals: p.medals,
      })),
    };
    await db.collection("matches").doc(match.id.toString()).set(matchData);
  }
  console.log(`${matches.length} matchs migrés.`);

  console.log("Migration terminée avec succès !");
}

migrate()
  .catch((err) => {
    console.error("Erreur critique durant la migration :", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });