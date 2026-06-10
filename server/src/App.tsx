import { useState, useEffect } from "react";
import { Info, Lock, Unlock, ShieldAlert, Sparkles, Trophy, Award, Calendar, RefreshCw, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { dbStore } from "./dbStore";
import { Player, Season, Match, Guild } from "./types";
import { getMedalIcon, getMedalTitle } from "./scoring";

import SplashModal from "./components/SplashModal";
import SlotMachineLottery from "./components/SlotMachineLottery";
import LeaderboardTab from "./components/LeaderboardTab";
import MatchEntryTab from "./components/MatchEntryTab";
import MatchHistoryTab from "./components/MatchHistoryTab";
import PlayersTab from "./components/PlayersTab";
import GuildsTab from "./components/GuildsTab";
import SeasonsTab from "./components/SeasonsTab";

export default function App() {
  // Navigation & Tab States
  const [activeTab, setActiveTab] = useState<"leaderboard" | "match" | "matches" | "players" | "guilds" | "seasons">("leaderboard");
  const [forceSplash, setForceOpenSplash] = useState(0);

  // Entities state
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);

  // Selected season for Leaderboard display
  const [lbSeasonId, setLbSeasonId] = useState<number | "">("");

  // Editing state for matches
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // Epic Celebration Modal state
  const [recordedMatch, setRecordedMatch] = useState<Match | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<{ id: number; message: string; type: "ok" | "err" | "info" }[]>([]);
  const [toastIdCounter, setToastIdCounter] = useState(0);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    resolve: (val: boolean) => void;
  } | null>(null);

  // Admin authentication state
  const [adminPassword, setAdminPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Sync state initially and subscribe to updates
  useEffect(() => {
    syncDatabase();

    const unsubscribe = dbStore.subscribe(() => {
      syncDatabase();
    });

    // Check if passcode already established in LocalStorage and is valid
    const savedCode = localStorage.getItem("dartos_admin_pass") || "";
    if (savedCode && savedCode === dbStore.getAdminPassword()) {
      setAdminPassword(savedCode);
      setIsUnlocked(true);
    } else if (savedCode) {
      localStorage.removeItem("dartos_admin_pass");
    }

    return () => {
      unsubscribe();
    };
  }, []); // Run ONLY once on mount to establish a stable stream!

  // Auto-select active season when seasons load
  useEffect(() => {
    if (lbSeasonId === "" && seasons.length > 0) {
      const now = new Date();
      const current = seasons.find(s => {
        const start = new Date(s.startedAt);
        const end = s.endedAt ? new Date(s.endedAt) : null;
        return start <= now && (!end || end >= now);
      });
      if (current) {
        setLbSeasonId(current.id);
      } else if (seasons.length > 0) {
        setLbSeasonId(seasons[0].id);
      }
    }
  }, [seasons, lbSeasonId]);

  const syncDatabase = () => {
    setPlayers([...dbStore.getPlayers()]);
    const allSeasons = dbStore.getSeasons();
    setSeasons(allSeasons);
    setMatches([...dbStore.getMatches()]);
    setGuilds([...dbStore.getGuilds()]);
  };

  // Toast loop helper
  const showToast = (message: string, type: "ok" | "err" | "info" = "info") => {
    const id = toastIdCounter;
    setToastIdCounter(prev => prev + 1);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  // Dialog promise wrapper
  const showConfirm = (message: string): Promise<boolean> => {
    return new Promise(resolve => {
      setConfirmDialog({
        isOpen: true,
        message,
        resolve: (val: boolean) => {
          setConfirmDialog(null);
          resolve(val);
        }
      });
    });
  };

  // Master Admin locks handler
  const handleLockClick = (): boolean => {
    if (isUnlocked) {
      // Clear password locks
      localStorage.removeItem("dartos_admin_pass");
      setAdminPassword("");
      setIsUnlocked(false);
      showToast("Verrouillé ! Privilèges d'administration désactivés.", "info");
      return false;
    } else {
      const psw = prompt("Saisissez ou créez le mot de passe d'administration :");
      if (psw === null) return false;
      const clean = psw.trim();
      if (!clean) {
        showToast("Le mot de passe ne peut pas être vide", "err");
        return false;
      }
      
      // Valider par rapport au mot de passe de la DB
      if (clean !== dbStore.getAdminPassword()) {
        showToast("Mot de passe incorrect !", "err");
        return false;
      }

      localStorage.setItem("dartos_admin_pass", clean);
      setAdminPassword(clean);
      setIsUnlocked(true);
      showToast("Déverrouillé ! Privilèges d'administration actifs ✓", "ok");
      return true;
    }
  };

  const verifyAdmin = async (): Promise<boolean> => {
    if (isUnlocked) return true;
    const ok = await showConfirm("Mode Administrateur requis. Déverrouiller maintenant ?");
    if (ok) {
      return handleLockClick();
    }
    return false;
  };

  const handleMatchRecorded = (newMatch: Match) => {
    // Open Celebration Modal
    setRecordedMatch(newMatch);
    syncDatabase();
  };

  const handleGainsSaved = (updatedMatch: Match) => {
    setRecordedMatch(updatedMatch);
    syncDatabase();
  };

  const handleEditMatch = async (m: Match) => {
    const authorised = await verifyAdmin();
    if (!authorised) return;

    setEditingMatch(m);
    setActiveTab("match");
    showToast(`Formulaire pré-rempli pour le match #${m.id}`, "info");
  };

  const handleDeleteMatch = async (id: number) => {
    const authorised = await verifyAdmin();
    if (!authorised) return;

    const ok = await showConfirm(`Supprimer le match #${id} ? Cette action recalculera les XPs des matchs suivants.`);
    if (!ok) return;

    try {
      dbStore.deleteMatch(id);
      showToast(`Match #${id} supprimé avec succès !`, "ok");
      syncDatabase();
    } catch (err: any) {
      showToast(err.message || "Erreur de suppression", "err");
    }
  };

  const handleRecalculateSeason = async (id: number) => {
    const authorised = await verifyAdmin();
    if (!authorised) return;

    const s = seasons.find(x => x.id === id);
    if (!s) return;

    const ok = await showConfirm(`Recalculer entièrement les scores XP pour la saison "${s.name}" ?`);
    if (!ok) return;

    try {
      const count = dbStore.recalculateSeasonMatches(id);
      showToast(`${count} match(s) recalculés avec succès ! ✓`, "ok");
      syncDatabase();
    } catch (err: any) {
      showToast(err.message || "Erreur lors du recalcul", "err");
    }
  };

  // Get active configurations of selected season inside celebration modal
  const activeSeasonForCelebration = recordedMatch ? seasons.find(s => s.id === recordedMatch.seasonId) : null;

  return (
    <div className="min-h-screen bg-cosmic-bg text-slate-100 flex flex-col font-sans select-none pb-8 antialiased relative overflow-x-hidden md:border-8 md:border-slate-900">
      {/* Decorative dot matrix grid background from the theme */}
      <div className="absolute inset-0 artistic-grid opacity-10 pointer-events-none z-0" />
      
      {/* Dynamic Splash screen */}
      <SplashModal forceOpen={forceSplash > 0} />

      {/* HEADER SECTION */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 pt-6 select-none sm:px-6">
        <div className="flex items-center justify-between py-4 border-b border-[#2A2A2E]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setForceOpenSplash(prev => prev + 1)}
              className="p-2 bg-slate-950 border border-[#2A2A2E] text-slate-400 hover:text-white rounded-lg hover:border-slate-700 transition cursor-pointer select-none"
              title="À propos de Dartos (Règles)"
            >
              <Info className="w-4 h-4" />
            </button>
            <div className="flex items-baseline gap-2">
              <h1 className="text-3xl font-black font-display tracking-tighter text-white select-none uppercase">
                D<span className="text-[#3dc7ff]">A</span>R<span className="text-[#3dc7ff]">TOS</span><span className="text-cosmic-accent font-extrabold text-glow">.</span>
              </h1>
              <span className="text-[10px] uppercase tracking-widest text-[#66666E] border border-slate-800 px-2 py-0.5 ml-1 bg-slate-950 rounded">v2.02</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:block text-right">
              <div className="text-[9px] uppercase tracking-[0.2em] text-[#66666E]">Statut d'Accès</div>
              <div className="text-xs font-bold text-white uppercase">{isUnlocked ? "Session Administrateur active" : "Mode Visiteur"}</div>
            </div>

            <div className="h-8 w-[1px] bg-[#2A2A2E] hidden md:block"></div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleLockClick}
                className={`p-2.5 rounded-lg border transition flex items-center justify-center cursor-pointer select-none font-medium ${
                  isUnlocked
                    ? "bg-cosmic-accent/15 hover:bg-cosmic-accent/25 border-cosmic-accent/40 text-cosmic-accent shadow-[0_0_15px_rgba(255,62,62,0.2)]"
                    : "bg-slate-950 hover:bg-slate-900 border-[#2A2A2E] text-slate-500 hover:text-slate-400"
                }`}
                title={isUnlocked ? "Fermer la session Administrateur" : "Entrer le code administrateur"}
              >
                {isUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* NAVIGATION MENUS */}
        <nav className="flex items-center gap-1.5 py-4 overflow-x-auto no-scrollbar font-display">
          {[
            { id: "leaderboard", label: "Classement", emoji: "🏆" },
            { id: "match", label: "Saisir Match", emoji: "⚔️" },
            { id: "matches", label: "Historique", emoji: "📜" },
            { id: "players", label: "Joueurs", emoji: "👤" },
            { id: "guilds", label: "Guildes", emoji: "🛡️" },
            { id: "seasons", label: "Saisons", emoji: "🏟️" }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-none border transition cursor-pointer select-none shrink-0 ${
                  isActive
                    ? "bg-[#16161A] text-white border-l-2 border-l-cosmic-accent border-[#2A2A2E] shadow-[0_0_15px_rgba(255,62,62,0.1)] font-extrabold"
                    : "bg-[#0F0F12]/80 border-[#2A2A2E]/50 hover:border-[#2A2A2E] text-slate-400 hover:text-white"
                }`}
              >
                <span>{tab.emoji}</span>
                <span className="ml-1.5">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* MAIN CONTAINER */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 py-4 sm:px-6 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + (editingMatch ? "-edit" : "")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            style={{ contentVisibility: "auto" }} // optimization
          >
            {activeTab === "leaderboard" && (
              <LeaderboardTab
                players={players}
                seasons={seasons}
                matches={matches}
                guilds={guilds}
                selectedSeasonId={lbSeasonId}
                setSelectedSeasonId={setLbSeasonId}
                onRecalculateSeason={handleRecalculateSeason}
                isAdmin={isUnlocked}
              />
            )}

            {activeTab === "match" && (
              <MatchEntryTab
                players={players}
                seasons={seasons}
                matches={matches}
                onMatchRecorded={handleMatchRecorded}
                editingMatch={editingMatch}
                setEditingMatch={setEditingMatch}
              />
            )}

            {activeTab === "matches" && (
              <MatchHistoryTab
                players={players}
                seasons={seasons}
                matches={matches}
                onDeleteMatch={handleDeleteMatch}
                onEditMatch={handleEditMatch}
              />
            )}

            {activeTab === "players" && (
              <PlayersTab
                players={players}
                matches={matches}
                guilds={guilds}
                seasons={seasons}
                onPlayersUpdated={syncDatabase}
                onShowToast={showToast}
                isAdmin={isUnlocked}
              />
            )}

            {activeTab === "guilds" && (
              <GuildsTab
                players={players}
                seasons={seasons}
                matches={matches}
                onGuildsUpdated={syncDatabase}
                onShowToast={showToast}
                onShowConfirm={showConfirm}
                activeSeasonId={lbSeasonId}
              />
            )}

            {activeTab === "seasons" && (
              <SeasonsTab
                seasons={seasons}
                onSeasonsUpdated={syncDatabase}
                onShowToast={showToast}
                onShowConfirm={showConfirm}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* EPIC CELEBRATION MODAL DISPLAY */}
      <AnimatePresence>
        {recordedMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
            >
              {/* Decorative crown animation */}
              <div className="bg-gradient-to-b from-amber-500/10 to-transparent p-6 text-center select-none space-y-1 relative">
                <span className="block text-4xl animate-bounce">👑</span>
                <h2 className="text-2xl font-black font-display tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-400">
                  MATCH TERMINÉ !
                </h2>
                <span className="text-[10px] text-amber-200/80 font-bold uppercase tracking-widest font-mono">Bataille validée dans l'arène</span>
              </div>

              {/* Participants listings */}
              <div className="p-5 overflow-y-auto space-y-3 divide-y divide-slate-800/40 max-h-[300px]" style={{ containIntrinsicSize: "auto 150px", contentVisibility: "auto" }}>
                {[...recordedMatch.participants].sort((a,b) => a.rank - b.rank).map((part, i) => {
                  const pData = players.find(x => x.id === part.playerId);
                  const isWinner = part.rank === 1;

                  return (
                    <div key={part.playerId} className={`pt-3 first:pt-0 flex items-center justify-between ${isWinner ? "pb-1.5" : ""}`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-md select-none font-bold text-[10px] flex items-center justify-center border ${
                          isWinner
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse"
                            : "bg-slate-950 border-slate-805 text-slate-500"
                        }`}>
                          {isWinner ? "🏆" : part.rank}
                        </span>
                        <div>
                          <span className="text-white font-bold text-sm block select-text">
                            {pData?.name || `Joueur #${part.playerId}`}
                          </span>
                          <div className="flex gap-1.5 items-center flex-wrap pt-0.5">
                            {part.finishType && (
                              <span className="text-[8px] uppercase tracking-wider font-extrabold text-amber-400 bg-amber-500/5 px-1 py-0.2 rounded border border-amber-500/10 select-none">
                                Closing : {part.finishType}
                              </span>
                            )}
                            {part.scoreLeft !== null && (
                              <span className="text-[8.5px] font-mono text-slate-500 leading-none">
                                Resté : {part.scoreLeft} pt(s)
                              </span>
                            )}
                            {part.medals.map(m => (
                              <span
                                key={m}
                                className="px-1 py-0.2 bg-slate-950 border border-slate-805 text-[9px] rounded font-semibold select-none cursor-help"
                                title={getMedalTitle(m)}
                              >
                                {getMedalIcon(m)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="font-mono font-black text-right text-emerald-400 text-base py-0.5 pr-2 select-text">
                        +{part.xpEarned} XP
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Slot machine Tombola integration */}
              {activeSeasonForCelebration && activeSeasonForCelebration.xpBonusLottery > 0 && (
                <div className="p-4 border-t border-slate-800/40 bg-slate-950/30 shrink-0">
                  <SlotMachineLottery
                    match={recordedMatch}
                    season={activeSeasonForCelebration}
                    players={players}
                    onGainsSaved={handleGainsSaved}
                  />
                </div>
              )}

              {/* Footer Celebrations button */}
              <div className="p-5 bg-slate-950 border-t border-slate-850 text-center shrink-0">
                <button
                  onClick={() => {
                    setRecordedMatch(null);
                    setActiveTab("matches");
                  }}
                  className="px-6 py-3 w-gradient bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-lg shadow-amber-500/5 transition transform hover:-translate-y-0.5"
                >
                  Célébrer & Continuer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER METRICS BAR matching Artistic Design */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 mt-8 py-4 border-t border-[#2A2A2E] flex flex-col sm:flex-row items-center justify-between gap-4 select-none sm:px-6">
        <div className="text-[9px] text-[#55555F] font-mono tracking-wider uppercase">
          SYS_COORD: 301.000 // XP_ENGINE_RUNNING // CODES_STABLE
        </div>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
            <span className="text-[9px] text-[#66666E] uppercase font-mono tracking-widest">Serveur Connecté</span>
          </div>
          <div className="text-[9px] text-[#66666E] uppercase font-mono tracking-widest">Latence: 14ms</div>
        </div>
      </footer>

      {/* GLOBAL FLOATING TOASTS PANEL */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm select-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              layout
              key={t.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={`p-3 rounded-none border flex items-center justify-between gap-3 shadow-lg select-none pointer-events-auto ${
                t.type === "ok"
                  ? "bg-emerald-950/40 border-emerald-500/35 text-emerald-300"
                  : t.type === "err"
                  ? "bg-red-950/40 border-red-500/35 text-red-300"
                  : "bg-[#111114] border-[#2A2A2E] text-white"
              }`}
            >
              <span className="text-xs font-semibold select-text pr-2 leading-relaxed">{t.message}</span>
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="text-slate-500 hover:text-white hover:bg-slate-800/40 p-1.5 rounded-none select-none cursor-pointer leading-none transition"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* STANDARD CONFIRMATION PORTAL */}
      <AnimatePresence>
        {confirmDialog && confirmDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm select-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111114] border-2 border-[#2A2A2E] rounded-none max-w-sm w-full p-6 shadow-2xl flex flex-col space-y-4"
            >
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-cosmic-accent shrink-0" />
                <p className="text-xs font-semibold text-slate-200 leading-relaxed select-text">{confirmDialog.message}</p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => confirmDialog.resolve(false)}
                  className="px-4 py-2 border border-[#2A2A2E] bg-slate-950 text-xs text-slate-400 hover:text-white rounded-none cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={() => confirmDialog.resolve(true)}
                  className="px-5 py-2 bg-gradient-to-r from-cosmic-accent to-[#8E1E1E] text-white font-extrabold text-xs uppercase tracking-widest rounded-none border border-cosmic-accent/30 cursor-pointer shadow"
                >
                  Confirmer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
