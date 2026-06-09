import { Player, Season, Match, Guild } from "./types";
import { getPlayersCareerXPs, getSeasonPlayerXPs, calculateGuildRank, calculateMatchResults } from "./scoring";

// Firebase imports
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc, getDocFromServer } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Error handling types and helper as specified by instructions
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const STORAGE_KEY = "dartos_db_v1";

interface DatabaseState {
  players: Player[];
  seasons: Season[];
  matches: Match[];
  guilds: Guild[];
  adminPassword?: string;
}

// Initial seeding data
const INITIAL_STATE: DatabaseState = {
  adminPassword: "admin", // Default admin password
  players: [
    { id: 1, name: "👑 Phil Taylor Gones", createdAt: "2026-01-10T12:00:00Z" },
    { id: 2, name: "🎯 Sniper_De_Comptoir", createdAt: "2026-01-12T14:30:00Z" },
    { id: 3, name: "🐉 Sacha TueurGeant 🦖", createdAt: "2026-01-15T18:15:00Z" },
    { id: 4, name: "🥔 Maurice PousseCaillou", createdAt: "2026-02-01T20:00:00Z" },
    { id: 5, name: "⭐ René le Chanceux 🍀", createdAt: "2026-02-14T11:00:00Z" }
  ],
  seasons: [
    {
      id: 1,
      name: "Saison d'Or 2026",
      startedAt: "2026-01-01T00:00:00Z",
      endedAt: "2026-12-31T23:59:59Z",
      xpPerDefeatedOpponent: 50,
      xpBonusSimple: 0,
      xpBonusDouble: 50,
      xpBonusTriple: 100,
      xpVampireMultiplier: 1.0,
      xpSurvivorBase: 25,
      xpBonusPoulidor: 15,
      xpBonusJackpot: 20,
      xpBonusEgalite: 10,
      xpBonusTueurDeGeants: 60,
      xpBonusPhenix: 30,
      xpBonusSerialWinner: 40,
      xpBonusBenjamin: 15,
      xpBonusLottery: 20,
      bonusVainqueurParRang: true
    },
    {
      id: 2,
      name: "Prélude Sudden Death",
      startedAt: "2025-06-01T00:00:00Z",
      endedAt: "2025-11-30T23:59:59Z",
      xpPerDefeatedOpponent: 40,
      xpBonusSimple: 10,
      xpBonusDouble: 40,
      xpBonusTriple: 80,
      xpVampireMultiplier: 0.5,
      xpSurvivorBase: 20,
      xpBonusPoulidor: 10,
      xpBonusJackpot: 15,
      xpBonusEgalite: 10,
      xpBonusTueurDeGeants: 50,
      xpBonusPhenix: 25,
      xpBonusSerialWinner: 30,
      xpBonusBenjamin: 10,
      xpBonusLottery: 15,
      bonusVainqueurParRang: false
    }
  ],
  matches: [
    {
      id: 1,
      seasonId: 1,
      playedAt: "2026-04-10T16:45:00Z",
      participants: [
        {
          playerId: 3,
          rank: 1,
          scoreLeft: null,
          xpBefore: 120,
          xpEarned: 240,
          finishType: "DOUBLE",
          medals: ["TUEUR_DE_GEANTS"]
        },
        {
          playerId: 1,
          rank: 2,
          scoreLeft: 8,
          xpBefore: 450,
          xpEarned: 40,
          medals: ["POULIDOR"]
        },
        {
          playerId: 4,
          rank: 3,
          scoreLeft: 55,
          xpBefore: 10,
          xpEarned: 45,
          medals: ["JACKPOT"]
        }
      ]
    },
    {
      id: 2,
      seasonId: 1,
      playedAt: "2026-05-20T21:00:00Z",
      participants: [
        {
          playerId: 1,
          rank: 1,
          scoreLeft: null,
          xpBefore: 530,
          xpEarned: 210,
          finishType: "TRIPLE",
          medals: []
        },
        {
          playerId: 2,
          rank: 2,
          scoreLeft: 22,
          xpBefore: 200,
          xpEarned: 45,
          medals: ["JACKPOT"]
        },
        {
          playerId: 5,
          rank: 3,
          scoreLeft: 22,
          xpBefore: 50,
          xpEarned: 55,
          medals: ["JACKPOT", "EGALITE"]
        }
      ]
    },
    {
      id: 3,
      seasonId: 1,
      playedAt: "2026-06-01T10:15:00Z",
      participants: [
        {
          playerId: 1,
          rank: 1,
          scoreLeft: null,
          xpBefore: 740,
          xpEarned: 10500,
          finishType: "TRIPLE",
          medals: ["SERIAL_WINNER"]
        },
        {
          playerId: 3,
          rank: 2,
          scoreLeft: 6,
          xpBefore: 120,
          xpEarned: 5300,
          medals: ["POULIDOR"]
        }
      ]
    }
  ],
  guilds: [
    {
      id: 1,
      name: "La Divine Triade",
      badgeIcon: "👑",
      badgeColor: "#fbbf24",
      createdAt: "2026-02-15T08:00:00Z",
      memberIds: [1, 3]
    },
    {
      id: 2,
      name: "Les Poulidors Givrés",
      badgeIcon: "🛡️",
      badgeColor: "#3dc7ff",
      createdAt: "2026-02-20T09:30:00Z",
      memberIds: [2, 4, 5]
    }
  ]
};

class DartosDB {
  private state: DatabaseState;
  private listeners: (() => void)[] = [];
  private isSeeding = false;
  private hasLoadedFromFirestoreOnce = false;
  private notifyTimeout: any = null;

  constructor() {
    // 1. Initialise with localStorage cached values first to build fast-boot capability
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        this.state = JSON.parse(raw);
        if (!this.state.players) this.state.players = [];
        if (!this.state.seasons) this.state.seasons = [];
        if (!this.state.matches) this.state.matches = [];
        if (!this.state.guilds) this.state.guilds = [];
        if (!this.state.adminPassword) this.state.adminPassword = "admin";
      } catch (e) {
        this.state = { ...INITIAL_STATE };
        this.saveLocalAndNotify();
      }
    } else {
      this.state = { ...INITIAL_STATE };
      // Save initially to local storage to have a fallback cache immediately
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    }

    // 2. Hydrate realtime updates from Firestore
    this.setupListeners();

    // 3. Test Connection
    this.testConnection();
  }

  private async testConnection() {
    try {
      await getDocFromServer(doc(db, 'players', '1'));
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    }
  }

  private setupListeners() {
    // Players query snapshot
    onSnapshot(collection(db, "players"), (snap) => {
      const players: Player[] = [];
      snap.forEach(d => {
        players.push(d.data() as Player);
      });
      // Do not wipe our initial/cached players if Firestore returns empty on startup or while seeding
      if (players.length === 0 && (this.isSeeding || !this.hasLoadedFromFirestoreOnce)) {
        return;
      }
      if (players.length > 0) {
        this.hasLoadedFromFirestoreOnce = true;
      }
      this.state.players = players.sort((a,b) => a.id - b.id);
      this.saveLocalAndNotify();
    }, (error) => {
      console.warn("Firestore players onSnapshot error: ", error);
    });

    // Seasons query snapshot
    onSnapshot(collection(db, "seasons"), (snap) => {
      const seasons: Season[] = [];
      snap.forEach(d => {
        seasons.push(d.data() as Season);
      });
      if (seasons.length === 0) {
        if (!this.isSeeding && !this.hasLoadedFromFirestoreOnce) {
          this.seedDatabaseIfEmpty();
        }
        return;
      }
      this.hasLoadedFromFirestoreOnce = true;
      this.state.seasons = seasons.sort((a,b) => a.id - b.id);
      this.saveLocalAndNotify();
    }, (error) => {
      console.warn("Firestore seasons onSnapshot error: ", error);
    });

    // Matches query snapshot
    onSnapshot(collection(db, "matches"), (snap) => {
      const matches: Match[] = [];
      snap.forEach(d => {
        matches.push(d.data() as Match);
      });
      // Do not wipe our initial/cached matches if Firestore returns empty on startup or while seeding
      if (matches.length === 0 && (this.isSeeding || !this.hasLoadedFromFirestoreOnce)) {
        return;
      }
      if (matches.length > 0) {
        this.hasLoadedFromFirestoreOnce = true;
      }
      this.state.matches = matches.sort((a,b) => a.id - b.id);
      this.saveLocalAndNotify();
    }, (error) => {
      console.warn("Firestore matches onSnapshot error: ", error);
    });

    // Guilds query snapshot
    onSnapshot(collection(db, "guilds"), (snap) => {
      const guilds: Guild[] = [];
      snap.forEach(d => {
        guilds.push(d.data() as Guild);
      });
      // Do not wipe our initial/cached guilds if Firestore returns empty on startup or while seeding
      if (guilds.length === 0 && (this.isSeeding || !this.hasLoadedFromFirestoreOnce)) {
        return;
      }
      if (guilds.length > 0) {
        this.hasLoadedFromFirestoreOnce = true;
      }
      this.state.guilds = guilds.sort((a,b) => a.id - b.id);
      this.saveLocalAndNotify();
    }, (error) => {
      console.warn("Firestore guilds onSnapshot error: ", error);
    });

    // AdminSettings document snapshot
    onSnapshot(doc(db, "adminSettings", "config"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        this.state.adminPassword = data.adminPassword || "admin";
        this.saveLocalAndNotify();
      }
    }, (error) => {
      console.warn("Firestore adminSettings config onSnapshot error: ", error);
    });
  }

  private async seedDatabaseIfEmpty() {
    if (this.isSeeding) return;
    this.isSeeding = true;
    try {
      console.log("Firestore empty. Seeding initial data objects...");
      // Seed players
      for (const player of INITIAL_STATE.players) {
        await setDoc(doc(db, "players", player.id.toString()), player);
      }
      // Seed seasons
      for (const season of INITIAL_STATE.seasons) {
        await setDoc(doc(db, "seasons", season.id.toString()), season);
      }
      // Seed matches
      for (const match of INITIAL_STATE.matches) {
        await setDoc(doc(db, "matches", match.id.toString()), match);
      }
      // Seed guilds
      for (const guild of INITIAL_STATE.guilds) {
        await setDoc(doc(db, "guilds", guild.id.toString()), guild);
      }
      // Seed admin settings
      await setDoc(doc(db, "adminSettings", "config"), { adminPassword: "admin" });
      console.log("Seeding finished successfully!");
      this.hasLoadedFromFirestoreOnce = true;
      this.saveLocalAndNotify();
    } catch (e) {
      console.error("Seeding error: ", e);
    } finally {
      this.isSeeding = false;
    }
  }

  private saveLocalAndNotify() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.notify();
  }

  subscribe(callback: () => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    if (this.notifyTimeout) {
      clearTimeout(this.notifyTimeout);
    }
    this.notifyTimeout = setTimeout(() => {
      this.listeners.forEach(l => l());
      this.notifyTimeout = null;
    }, 50);
  }

  // --- Admin ---
  getAdminPassword(): string {
    return this.state.adminPassword || "admin";
  }

  async setAdminPassword(psw: string) {
    const cleanPassword = psw.trim() || "admin";
    try {
      await setDoc(doc(db, "adminSettings", "config"), { adminPassword: cleanPassword });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "adminSettings/config");
    }
    this.state.adminPassword = cleanPassword;
    this.saveLocalAndNotify();
  }

  // --- Players ---
  getPlayers(): Player[] {
    return this.state.players;
  }

  async createPlayer(name: string): Promise<Player> {
    const exists = this.state.players.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      throw new Error("Un joueur avec ce nom existe déjà");
    }
    const maxId = this.state.players.reduce((max, p) => p.id > max ? p.id : max, 0);
    const player: Player = {
      id: maxId + 1,
      name: name.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "players", player.id.toString()), player);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `players/${player.id}`);
    }

    this.state.players.push(player);
    this.saveLocalAndNotify();
    return player;
  }

  async updatePlayer(id: number, name: string): Promise<Player> {
    const player = this.state.players.find(p => p.id === id);
    if (!player) throw new Error("Joueur introuvable");

    const exists = this.state.players.some(p => p.id !== id && p.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      throw new Error("Un joueur avec ce nom existe déjà");
    }

    const updated = {
      ...player,
      name: name.trim()
    };

    try {
      await setDoc(doc(db, "players", id.toString()), updated);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `players/${id}`);
    }

    player.name = name.trim();
    this.saveLocalAndNotify();
    return player;
  }

  // --- Seasons ---
  getSeasons(): Season[] {
    return [...this.state.seasons].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async createSeason(season: Omit<Season, "id">): Promise<Season> {
    const exists = this.state.seasons.some(s => s.name.trim().toLowerCase() === season.name.trim().toLowerCase());
    if (exists) {
      throw new Error("Une saison avec ce nom existe déjà");
    }
    const maxId = this.state.seasons.reduce((max, s) => s.id > max ? s.id : max, 0);
    const newSeason: Season = {
      ...season,
      id: maxId + 1
    };

    try {
      await setDoc(doc(db, "seasons", newSeason.id.toString()), newSeason);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `seasons/${newSeason.id}`);
    }

    this.state.seasons.push(newSeason);
    this.saveLocalAndNotify();
    return newSeason;
  }

  async updateSeason(id: number, seasonData: Partial<Omit<Season, "id">>): Promise<{ season: Season; matchesRecalculated: number }> {
    const index = this.state.seasons.findIndex(s => s.id === id);
    if (index === -1) throw new Error("Saison introuvable");

    if (seasonData.name) {
      const exists = this.state.seasons.some(s => s.id !== id && s.name.trim().toLowerCase() === seasonData.name!.trim().toLowerCase());
      if (exists) {
        throw new Error("Une saison avec ce nom existe déjà");
      }
    }

    const updated = {
      ...this.state.seasons[index],
      ...seasonData
    } as Season;

    try {
      await setDoc(doc(db, "seasons", id.toString()), updated);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `seasons/${id}`);
    }

    this.state.seasons[index] = updated;
    this.saveLocalAndNotify();

    // Trigger auto-recalculation of all matches in this season
    const matchesRecalculated = await this.recalculateSeasonMatches(id);
    return { season: updated, matchesRecalculated };
  }

  async deleteSeason(id: number) {
    const sIndex = this.state.seasons.findIndex(s => s.id === id);
    if (sIndex === -1) throw new Error("Saison introuvable");

    const matchesToRemove = this.state.matches.filter(m => m.seasonId === id);

    try {
      await deleteDoc(doc(db, "seasons", id.toString()));
      for (const m of matchesToRemove) {
        await deleteDoc(doc(db, "matches", m.id.toString()));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `seasons/${id}`);
    }

    this.state.seasons.splice(sIndex, 1);
    this.state.matches = this.state.matches.filter(m => m.seasonId !== id);
    this.saveLocalAndNotify();
  }

  // --- Matches ---
  getMatches(seasonId?: number): Match[] {
    const filtered = seasonId ? this.state.matches.filter(m => m.seasonId === seasonId) : this.state.matches;
    return [...filtered].sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
  }

  async recordMatch(match: Omit<Match, "id">): Promise<Match> {
    const maxId = this.state.matches.reduce((max, m) => m.id > max ? m.id : max, 0);
    const newMatch: Match = {
      ...match,
      id: maxId + 1
    };

    try {
      await setDoc(doc(db, "matches", newMatch.id.toString()), newMatch);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${newMatch.id}`);
    }

    this.state.matches.push(newMatch);
    this.saveLocalAndNotify();
    return newMatch;
  }

  async updateMatch(id: number, updatedData: Omit<Match, "id">): Promise<Match> {
    const index = this.state.matches.findIndex(m => m.id === id);
    if (index === -1) throw new Error("Match introuvable");
    const updated: Match = {
      ...updatedData,
      id
    };

    try {
      await setDoc(doc(db, "matches", id.toString()), updated);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${id}`);
    }

    this.state.matches[index] = updated;
    this.saveLocalAndNotify();
    return updated;
  }

  async deleteMatch(id: number) {
    const index = this.state.matches.findIndex(m => m.id === id);
    if (index === -1) throw new Error("Match introuvable");

    try {
      await deleteDoc(doc(db, "matches", id.toString()));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `matches/${id}`);
    }

    this.state.matches.splice(index, 1);
    this.saveLocalAndNotify();
  }

  // --- Tombola update ---
  async updateLotteryGains(matchId: number, playerGains: { playerId: number; xpBonus: number; emojis: string[] }[]): Promise<Match> {
    const match = this.state.matches.find(m => m.id === matchId);
    if (!match) throw new Error("Match introuvable");

    const cloned = JSON.parse(JSON.stringify(match)) as Match;

    playerGains.forEach(gain => {
      const p = cloned.participants.find(part => part.playerId === gain.playerId);
      if (p) {
        p.xpEarned += gain.xpBonus;
        p.xpBonusLotteryEarned = (p.xpBonusLotteryEarned || 0) + gain.xpBonus;
        
        const currentMedals = p.medals || [];
        gain.emojis.forEach(emoji => {
          const medalStr = `LOTTERY_WINNER:${emoji}`;
          if (!currentMedals.includes(medalStr)) {
            currentMedals.push(medalStr);
          }
        });
        p.medals = currentMedals;
      }
    });

    try {
      await setDoc(doc(db, "matches", matchId.toString()), cloned);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${matchId}`);
    }

    const idx = this.state.matches.findIndex(m => m.id === matchId);
    if (idx !== -1) {
      this.state.matches[idx] = cloned;
    }
    this.saveLocalAndNotify();
    return cloned;
  }

  // --- Guilds ---
  getGuilds(): Guild[] {
    return this.state.guilds;
  }

  async createGuild(payload: { name: string; badgeIcon: string; badgeColor: string }): Promise<Guild> {
    const exists = this.state.guilds.some(g => g.name.trim().toLowerCase() === payload.name.trim().toLowerCase());
    if (exists) {
      throw new Error("Une guilde avec ce nom existe déjà");
    }
    const maxId = this.state.guilds.reduce((max, g) => g.id > max ? g.id : max, 0);
    const guild: Guild = {
      id: maxId + 1,
      name: payload.name.trim(),
      badgeIcon: payload.badgeIcon.trim(),
      badgeColor: payload.badgeColor.trim(),
      createdAt: new Date().toISOString(),
      memberIds: []
    };

    try {
      await setDoc(doc(db, "guilds", guild.id.toString()), guild);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `guilds/${guild.id}`);
    }

    this.state.guilds.push(guild);
    this.saveLocalAndNotify();
    return guild;
  }

  async updateGuild(id: number, payload: { name?: string; badgeIcon?: string; badgeColor?: string }): Promise<Guild> {
    const guild = this.state.guilds.find(g => g.id === id);
    if (!guild) throw new Error("Guilde introuvable");

    const cloned = { ...guild };

    if (payload.name) {
      const exists = this.state.guilds.some(g => g.id !== id && g.name.trim().toLowerCase() === payload.name!.trim().toLowerCase());
      if (exists) {
        throw new Error("Une guilde avec ce nom existe déjà");
      }
      cloned.name = payload.name.trim();
    }
    if (payload.badgeIcon) cloned.badgeIcon = payload.badgeIcon.trim();
    if (payload.badgeColor) cloned.badgeColor = payload.badgeColor.trim();

    try {
      await setDoc(doc(db, "guilds", id.toString()), cloned);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `guilds/${id}`);
    }

    Object.assign(guild, cloned);
    this.saveLocalAndNotify();
    return guild;
  }

  async deleteGuild(id: number) {
    const index = this.state.guilds.findIndex(g => g.id === id);
    if (index === -1) throw new Error("Guilde introuvable");

    try {
      await deleteDoc(doc(db, "guilds", id.toString()));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `guilds/${id}`);
    }

    this.state.guilds.splice(index, 1);
    this.saveLocalAndNotify();
  }

  async joinGuild(guildId: number, playerId: number): Promise<Guild> {
    const guild = this.state.guilds.find(g => g.id === guildId);
    if (!guild) throw new Error("Guilde introuvable");

    // Players can only be in one guild at a time
    const updatedGuilds = this.state.guilds.map(g => {
      const updated = { ...g };
      if (g.id === guildId) {
        if (!updated.memberIds.includes(playerId)) {
          updated.memberIds = [...updated.memberIds, playerId];
        }
      } else {
        updated.memberIds = updated.memberIds.filter(id => id !== playerId);
      }
      return updated;
    });

    try {
      for (const g of updatedGuilds) {
        await setDoc(doc(db, "guilds", g.id.toString()), g);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `guilds/${guildId}`);
    }

    this.state.guilds = updatedGuilds;
    this.saveLocalAndNotify();
    return this.state.guilds.find(g => g.id === guildId)!;
  }

  async leaveGuild(guildId: number, playerId: number): Promise<Guild> {
    const guild = this.state.guilds.find(g => g.id === guildId);
    if (!guild) throw new Error("Guilde introuvable");

    const cloned = { ...guild };
    cloned.memberIds = cloned.memberIds.filter(id => id !== playerId);

    try {
      await setDoc(doc(db, "guilds", guildId.toString()), cloned);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `guilds/${guildId}`);
    }

    guild.memberIds = cloned.memberIds;
    this.saveLocalAndNotify();
    return guild;
  }

  // --- Calculations & Auto-Recalculate engine ---
  async recalculateSeasonMatches(seasonId: number): Promise<number> {
    const season = this.state.seasons.find(s => s.id === seasonId);
    if (!season) return 0;

    const seasonMatches = this.state.matches
      .filter(m => m.seasonId === seasonId)
      .sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());

    if (seasonMatches.length === 0) return 0;

    const allMatches = [...this.state.matches].sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());

    const simulatedCareerXPs = new Map<number, number>();

    const firstSeasonMatchTime = new Date(seasonMatches[0].playedAt).getTime();
    const priorMatches = allMatches.filter(m => new Date(m.playedAt).getTime() < firstSeasonMatchTime);

    for (const pm of priorMatches) {
      for (const part of pm.participants) {
        const cur = simulatedCareerXPs.get(part.playerId) || 0;
        simulatedCareerXPs.set(part.playerId, cur + part.xpEarned);
      }
    }

    for (const m of seasonMatches) {
      const winnerPart = m.participants.find(p => p.rank === 1);
      const loserParts = m.participants.filter(p => p.rank > 1);

      if (!winnerPart) continue;

      const winnerId = winnerPart.playerId;
      const finishType = winnerPart.finishType || "SIMPLE";

      const losers = loserParts.map(lp => ({
        playerId: lp.playerId,
        scoreLeft: lp.scoreLeft ?? 50
      }));

      const winnerCareerXPBefore = simulatedCareerXPs.get(winnerId) || 0;
      const loserXPBeforeMap = new Map<number, number>();
      losers.forEach(l => {
        loserXPBeforeMap.set(l.playerId, simulatedCareerXPs.get(l.playerId) || 0);
      });

      const currentIndexInSeason = seasonMatches.findIndex(match => match.id === m.id);
      let consecutiveWins = 0;
      for (let i = currentIndexInSeason - 1; i >= 0; i--) {
        const prevMatch = seasonMatches[i];
        const prevWinner = prevMatch.participants.find(p => p.rank === 1);
        if (prevWinner && prevWinner.playerId === winnerId) {
          consecutiveWins++;
        } else {
          break;
        }
      }

      const recalculated = calculateMatchResults(
        winnerId,
        finishType,
        losers,
        winnerCareerXPBefore,
        loserXPBeforeMap,
        season,
        consecutiveWins
      );

      const updatedParticipants = m.participants.map(p => {
        const recalc = recalculated.find(r => r.playerId === p.playerId);
        if (!recalc) return p;

        const lotteryBonus = p.xpBonusLotteryEarned || 0;

        const finalMedals = [...recalc.medals];
        const existingLotteryMedals = (p.medals || []).filter(med => med.startsWith("LOTTERY_WINNER:"));
        existingLotteryMedals.forEach(lotm => {
          if (!finalMedals.includes(lotm)) {
            finalMedals.push(lotm);
          }
        });

        return {
          ...p,
          xpBefore: recalc.xpBefore,
          xpEarned: recalc.xpEarned + lotteryBonus,
          medals: finalMedals
        };
      });

      m.participants = updatedParticipants;

      for (const p of m.participants) {
        simulatedCareerXPs.set(p.playerId, (simulatedCareerXPs.get(p.playerId) || 0) + p.xpEarned);
      }

      // Write changes to Firestore
      try {
        await setDoc(doc(db, "matches", m.id.toString()), m);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `matches/${m.id}`);
      }
    }

    this.saveLocalAndNotify();
    return seasonMatches.length;
  }
}

export const dbStore = new DartosDB();
