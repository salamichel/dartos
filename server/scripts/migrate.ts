import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, writeBatch } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Firebase config
const configPath = path.resolve(__dirname, "../firebase-applet-config.json");
if (!fs.existsSync(configPath)) {
  console.error("❌ Impossible de trouver firebase-applet-config.json à la racine de l'application.");
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

console.log("🔥 Firebase Initialisé avec la base :", firebaseConfig.firestoreDatabaseId);

// Interfaces for local models (JSON or Prisma exports)
interface PlayerPrisma {
  id: number;
  name: string;
  createdAt?: string | Date;
  created_at?: string | Date; // alternate map
}

interface SeasonPrisma {
  id: number;
  name: string;
  startedAt?: string | Date;
  started_at?: string | Date;
  endedAt?: string | Date | null;
  ended_at?: string | Date | null;
  xpPerDefeatedOpponent?: number;
  xp_per_defeated_opponent?: number;
  xpBonusSimple?: number;
  xp_bonus_simple?: number;
  xpBonusDouble?: number;
  xp_bonus_double?: number;
  xpBonusTriple?: number;
  xp_bonus_triple?: number;
  xpVampireMultiplier?: number;
  xp_vampire_multiplier?: number;
  xpSurvivorBase?: number;
  xp_survivor_base?: number;
  xpBonusPoulidor?: number;
  xp_bonus_poulidor?: number;
  xpBonusJackpot?: number;
  xp_bonus_jackpot?: number;
  xpBonusEgalite?: number;
  xp_bonus_egalite?: number;
  xpBonusTueurDeGeants?: number;
  xp_bonus_tueur_de_geants?: number;
  xpBonusPhenix?: number;
  xp_bonus_phenix?: number;
  xpBonusSerialWinner?: number;
  xp_bonus_serial_winner?: number;
  xpBonusBenjamin?: number;
  xp_bonus_benjamin?: number;
  xpBonusLottery?: number;
  xp_bonus_lottery?: number;
  bonusVainqueurParRang?: boolean;
  bonus_vainqueur_par_rang?: boolean;
}

interface MatchPrisma {
  id: number;
  seasonId?: number;
  season_id?: number;
  playedAt?: string | Date;
  played_at?: string | Date;
}

interface MatchParticipantPrisma {
  matchId?: number;
  match_id?: number;
  playerId?: number;
  player_id?: number;
  rank: number;
  scoreLeft?: number | null;
  score_left?: number | null;
  xpBefore?: number;
  xp_before?: number;
  xpEarned?: number;
  xp_earned?: number;
  xpBonusLotteryEarned?: number;
  xp_bonus_lottery_earned?: number;
  finishType?: string | null;
  finish_type?: string | null;
  medals?: string[] | string; // could be JSON string or array
}

interface GuildPrisma {
  id: number;
  name: string;
  badgeIcon?: string;
  badge_icon?: string;
  badgeColor?: string;
  badge_color?: string;
  createdAt?: string | Date;
  created_at?: string | Date;
}

interface PlayerGuildPrisma {
  playerId?: number;
  player_id?: number;
  guildId?: number;
  guild_id?: number;
}

/**
 * Standardize dates of any format to ISO Strings
 */
function toISOString(date: any): string {
  if (!date) return new Date().toISOString();
  return new Date(date).toISOString();
}

/**
 * Format string array or string representation of medals
 */
function parseMedals(medals: any): string[] {
  if (!medals) return [];
  if (Array.isArray(medals)) return medals;
  try {
    return JSON.parse(medals);
  } catch {
    return [String(medals)];
  }
}

/**
 * Safely remove undefined properties or replace them with null to prevent Firestore errors
 */
function sanitizeForFirestore(obj: any): any {
  if (obj === null) return null;
  if (obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  if (typeof obj === "object") {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        result[key] = sanitizeForFirestore(val);
      }
    }
    return result;
  }
  return obj;
}

/**
 * Perform Firestore uploads using batches
 */
async function uploadToCollection(collectionName: string, idField: string, dataArray: any[]) {
  console.log(`📤 Envoi de ${dataArray.length} documents vers la collection "${collectionName}"...`);
  
  // Firestore batches are limited to 500 operations
  const BATCH_LIMIT = 400;
  let count = 0;
  let batch = writeBatch(db);

  for (const docData of dataArray) {
    const docId = docData[idField].toString();
    const docRef = doc(db, collectionName, docId);
    const cleanData = sanitizeForFirestore(docData);
    batch.set(docRef, cleanData);
    count++;

    if (count % BATCH_LIMIT === 0) {
      await batch.commit();
      console.log(`  ✓ Lot de ${count} documents envoyé`);
      batch = writeBatch(db);
    }
  }

  if (count % BATCH_LIMIT !== 0) {
    await batch.commit();
    console.log(`  ✓ Derniers documents envoyés (Total: ${count})`);
  }
}

/**
 * JSON File Migration Runner
 */
async function runJsonMigration(folderPath: string) {
  console.log(`📂 Lecture des fichiers JSON depuis : ${folderPath}`);

  const readJson = (file: string): any[] => {
    const fullPath = path.resolve(folderPath, file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ Fichier non trouvé : ${file}. Les données correspondantes seront sautées.`);
      return [];
    }
    return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  };

  const playersRaw: PlayerPrisma[] = readJson("players.json");
  const seasonsRaw: SeasonPrisma[] = readJson("seasons.json");
  const matchesRaw: MatchPrisma[] = readJson("matches.json");
  const matchParticipantsRaw: MatchParticipantPrisma[] = readJson("match_participants.json");
  const guildsRaw: GuildPrisma[] = readJson("guilds.json");
  const playerGuildsRaw: PlayerGuildPrisma[] = readJson("player_guilds.json");

  // ==== 1. MIGRATE PLAYERS ====
  const players = playersRaw.map(p => ({
    id: Number(p.id),
    name: String(p.name).trim(),
    createdAt: toISOString(p.createdAt || p.created_at)
  }));

  // ==== 2. MIGRATE SEASONS ====
  const seasons = seasonsRaw.map(s => ({
    id: Number(s.id),
    name: String(s.name).trim(),
    startedAt: toISOString(s.startedAt || s.started_at),
    endedAt: (s.endedAt || s.ended_at) ? toISOString(s.endedAt || s.ended_at) : null,
    xpPerDefeatedOpponent: Number(s.xpPerDefeatedOpponent ?? s.xp_per_defeated_opponent ?? 50),
    xpBonusSimple: Number(s.xpBonusSimple ?? s.xp_bonus_simple ?? 0),
    xpBonusDouble: Number(s.xpBonusDouble ?? s.xp_bonus_double ?? 50),
    xpBonusTriple: Number(s.xpBonusTriple ?? s.xp_bonus_triple ?? 100),
    xpVampireMultiplier: Number(s.xpVampireMultiplier ?? s.xp_vampire_multiplier ?? 1.0),
    xpSurvivorBase: Number(s.xpSurvivorBase ?? s.xp_survivor_base ?? 20),
    xpBonusPoulidor: Number(s.xpBonusPoulidor ?? s.xp_bonus_poulidor ?? 15),
    xpBonusJackpot: Number(s.xpBonusJackpot ?? s.xp_bonus_jackpot ?? 20),
    xpBonusEgalite: Number(s.xpBonusEgalite ?? s.xp_bonus_egalite ?? 10),
    xpBonusTueurDeGeants: Number(s.xpBonusTueurDeGeants ?? s.xp_bonus_tueur_de_geants ?? 50),
    xpBonusPhenix: Number(s.xpBonusPhenix ?? s.xp_bonus_phenix ?? 0),
    xpBonusSerialWinner: Number(s.xpBonusSerialWinner ?? s.xp_bonus_serial_winner ?? 0),
    xpBonusBenjamin: Number(s.xpBonusBenjamin ?? s.xp_bonus_benjamin ?? 0),
    xpBonusLottery: Number(s.xpBonusLottery ?? s.xp_bonus_lottery ?? 0),
    bonusVainqueurParRang: Boolean(s.bonusVainqueurParRang ?? s.bonus_vainqueur_par_rang ?? false)
  }));

  // ==== 3. MIGRATE MATCHES & EMBED MATCH PARTICIPANTS ====
  const matchesMap = new Map<number, any[]>();
  matchParticipantsRaw.forEach(mp => {
    const mId = mp.matchId ?? mp.match_id;
    if (mId === undefined) return;
    const pId = mp.playerId ?? mp.player_id;
    if (pId === undefined) return;

    if (!matchesMap.has(mId)) {
      matchesMap.set(mId, []);
    }

    matchesMap.get(mId)!.push({
      playerId: Number(pId),
      rank: Number(mp.rank),
      scoreLeft: mp.scoreLeft !== undefined ? (mp.scoreLeft ?? mp.score_left ?? null) : null,
      xpBefore: Number(mp.xpBefore ?? mp.xp_before ?? 0),
      xpEarned: Number(mp.xpEarned ?? mp.xp_earned ?? 0),
      xpBonusLotteryEarned: Number(mp.xpBonusLotteryEarned ?? mp.xp_bonus_lottery_earned ?? 0),
      finishType: mp.finishType ?? mp.finish_type ?? undefined,
      medals: parseMedals(mp.medals)
    });
  });

  const matches = matchesRaw.map(m => {
    const participantsList = matchesMap.get(m.id) || [];
    return {
      id: Number(m.id),
      seasonId: Number(m.seasonId ?? m.season_id ?? 0),
      playedAt: toISOString(m.playedAt || m.played_at),
      participants: participantsList.sort((a, b) => a.rank - b.rank)
    };
  });

  // ==== 4. MIGRATE GUILDS & EMBED MEMBER PATHS ====
  const guildsMap = new Map<number, number[]>();
  playerGuildsRaw.forEach(pg => {
    const gId = pg.guildId ?? pg.guild_id;
    const pId = pg.playerId ?? pg.player_id;
    if (gId === undefined || pId === undefined) return;

    if (!guildsMap.has(gId)) {
      guildsMap.set(gId, []);
    }
    guildsMap.get(gId)!.push(Number(pId));
  });

  const guilds = guildsRaw.map(g => ({
    id: Number(g.id),
    name: String(g.name).trim(),
    badgeIcon: String(g.badgeIcon ?? g.badge_icon ?? "🛡️"),
    badgeColor: String(g.badgeColor ?? g.badge_color ?? "#3bd6ff"),
    createdAt: toISOString(g.createdAt || g.created_at),
    memberIds: guildsMap.get(g.id) || []
  }));

  // ==== 5. UPLOAD EVERYTHING ======
  if (players.length > 0) await uploadToCollection("players", "id", players);
  if (seasons.length > 0) await uploadToCollection("seasons", "id", seasons);
  if (matches.length > 0) await uploadToCollection("matches", "id", matches);
  if (guilds.length > 0) await uploadToCollection("guilds", "id", guilds);

  console.log("\n🚀 Migration terminée avec succès !");
}

/**
 * Direct Postgres DB migration via Prisma Client if installed
 */
async function runPrismaMigration() {
  try {
    // Dynamically require to prevent compile errors if Prisma is not local
    // @ts-ignore
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    console.log("🔌 Connexion à Prisma Client et récupération des données...");

    const pRecords = await prisma.player.findMany();
    const sRecords = await prisma.season.findMany();
    const mRecords = await prisma.match.findMany({
      include: {
        participants: true
      }
    });
    const gRecords = await prisma.guild.findMany({
      include: {
        members: true
      }
    });

    // ==== Map database models to application models ====
    const players = pRecords.map((p: any) => ({
      id: p.id,
      name: p.name.trim(),
      createdAt: toISOString(p.createdAt || p.created_at)
    }));

    const seasons = sRecords.map((s: any) => ({
      id: s.id,
      name: s.name.trim(),
      startedAt: toISOString(s.startedAt || s.started_at),
      endedAt: (s.endedAt || s.ended_at) ? toISOString(s.endedAt || s.ended_at) : null,
      xpPerDefeatedOpponent: s.xpPerDefeatedOpponent ?? s.xp_per_defeated_opponent ?? 50,
      xpBonusSimple: s.xpBonusSimple ?? s.xp_bonus_simple ?? 0,
      xpBonusDouble: s.xpBonusDouble ?? s.xp_bonus_double ?? 50,
      xpBonusTriple: s.xpBonusTriple ?? s.xp_bonus_triple ?? 100,
      xpVampireMultiplier: s.xpVampireMultiplier ?? s.xp_vampire_multiplier ?? 1.0,
      xpSurvivorBase: s.xpSurvivorBase ?? s.xp_survivor_base ?? 20,
      xpBonusPoulidor: s.xpBonusPoulidor ?? s.xp_bonus_poulidor ?? 15,
      xpBonusJackpot: s.xpBonusJackpot ?? s.xp_bonus_jackpot ?? 20,
      xpBonusEgalite: s.xpBonusEgalite ?? s.xp_bonus_egalite ?? 10,
      xpBonusTueurDeGeants: s.xpBonusTueurDeGeants ?? s.xp_bonus_tueur_de_geants ?? 50,
      xpBonusPhenix: s.xpBonusPhenix ?? s.xp_bonus_phenix ?? 0,
      xpBonusSerialWinner: s.xpBonusSerialWinner ?? s.xp_bonus_serial_winner ?? 0,
      xpBonusBenjamin: s.xpBonusBenjamin ?? s.xp_bonus_benjamin ?? 0,
      xpBonusLottery: s.xpBonusLottery ?? s.xp_bonus_lottery ?? 0,
      bonusVainqueurParRang: s.bonusVainqueurParRang ?? s.bonus_vainqueur_par_rang ?? false
    }));

    const matches = mRecords.map((m: any) => {
      const parts = m.participants.map((p: any) => ({
        playerId: p.playerId ?? p.player_id,
        rank: p.rank,
        scoreLeft: p.scoreLeft !== undefined ? (p.scoreLeft ?? p.score_left ?? null) : null,
        xpBefore: p.xpBefore ?? p.xp_before ?? 0,
        xpEarned: p.xpEarned ?? p.xp_earned ?? 0,
        xpBonusLotteryEarned: p.xpBonusLotteryEarned ?? p.xp_bonus_lottery_earned ?? 0,
        finishType: p.finishType ?? p.finish_type ?? undefined,
        medals: parseMedals(p.medals)
      }));

      return {
        id: m.id,
        seasonId: m.seasonId ?? m.season_id,
        playedAt: toISOString(m.playedAt || m.played_at),
        participants: parts.sort((a: any, b: any) => a.rank - b.rank)
      };
    });

    const guilds = gRecords.map((g: any) => ({
      id: g.id,
      name: g.name.trim(),
      badgeIcon: g.badgeIcon ?? g.badge_icon ?? "🛡️",
      badgeColor: g.badgeColor ?? g.badge_color ?? "#3bd6ff",
      createdAt: toISOString(g.createdAt || g.created_at),
      memberIds: g.members.map((m: any) => m.playerId ?? m.player_id)
    }));

    // ==== UPLOAD ====
    if (players.length > 0) await uploadToCollection("players", "id", players);
    if (seasons.length > 0) await uploadToCollection("seasons", "id", seasons);
    if (matches.length > 0) await uploadToCollection("matches", "id", matches);
    if (guilds.length > 0) await uploadToCollection("guilds", "id", guilds);

    console.log("\n🚀 Migration via Prisma Client terminée avec succès !");
    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ Échec de la migration directe via Prisma Client :", error);
    console.log("Veuillez vous assurer que Prisma Client est bien configuré avec DATABASE_URL.");
  }
}

// ==== CLI Command Parsing ====
const args = process.argv.slice(2);
const jsonFolderIndex = args.indexOf("--json");
const isPrismaDirectMode = args.includes("--prisma");

if (jsonFolderIndex !== -1 && args[jsonFolderIndex + 1]) {
  const folder = args[jsonFolderIndex + 1];
  runJsonMigration(folder).catch(err => {
    console.error("❌ Erreur critique de migration JSON-to-Firestore :", err);
    process.exit(1);
  });
} else if (isPrismaDirectMode) {
  runPrismaMigration().catch(err => {
    console.error("❌ Erreur de migration Prisma-to-Firestore :", err);
    process.exit(1);
  });
} else {
  console.log(`
ℹ️  USAGE GUIDES ℹ️

Ce script permet d'importer toutes vos tables Prisma (SQL/Postgres) directement dans Firebase Firestore.
Pour cela, vous avez deux méthodes extrêmement simples :

--------------------------------------------------
MÉTHODE A: VIA DES EXPORTS JSON (Recommandé & Facile !)
--------------------------------------------------
1. Exportez vos tables Prisma existantes en fichiers JSON. Vous pouvez par exemple exécuter cette commande dans votre terminal là où Prisma est configuré :
   npx tsx -e "
     import { PrismaClient } from '@prisma/client';
     import * as fs from 'fs';
     const prisma = new PrismaClient();
     async function main() {
       fs.writeFileSync('players.json', JSON.stringify(await prisma.player.findMany()));
       fs.writeFileSync('seasons.json', JSON.stringify(await prisma.season.findMany()));
       fs.writeFileSync('matches.json', JSON.stringify(await prisma.match.findMany()));
       fs.writeFileSync('match_participants.json', JSON.stringify(await prisma.matchParticipant.findMany()));
       fs.writeFileSync('guilds.json', JSON.stringify(await prisma.guild.findMany()));
       fs.writeFileSync('player_guilds.json', JSON.stringify(await prisma.playerGuild.findMany()));
       console.log('Tables exportées correctement !');
     }
     main();
   "

2. Créez un dossier nommé \"migration\" à la racine de ce projet et placez-y ces 6 fichiers JSON.
3. Exécutez la migration avec la commande suivante :
   npx tsx scripts/migrate.ts --json ./migration

--------------------------------------------------
MÉTHODE B: CONNEXION DIRECTE PRISMA CLIENT
--------------------------------------------------
Si vous exécutez ce script directement au sein de votre environnement où Prisma Client est configuré avec votre DATABASE_URL :
1. Exécutez simplement :
   npx tsx scripts/migrate.ts --prisma
`);
}
