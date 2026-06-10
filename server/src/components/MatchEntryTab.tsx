import React, { useState, useEffect } from "react";
import { User, Trophy, Eye, Plus, Calendar, AlertCircle, Save } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Player, Season, Match, FinishType, MatchParticipant } from "../types";
import { countConsecutiveWinsBefore, calculateMatchResults } from "../scoring";
import { dbStore } from "../dbStore";

interface MatchEntryTabProps {
  players: Player[];
  seasons: Season[];
  matches: Match[];
  onMatchRecorded: (newMatch: Match) => void;
  editingMatch: Match | null;
  setEditingMatch: (m: Match | null) => void;
}

export default function MatchEntryTab({
  players,
  seasons,
  matches,
  onMatchRecorded,
  editingMatch,
  setEditingMatch
}: MatchEntryTabProps) {
  const [playedAt, setPlayedAt] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [winnerFinish, setWinnerFinish] = useState<FinishType>("DOUBLE");
  const [scoresLeft, setScoresLeft] = useState<Record<number, string>>({});
  const [statusText, setStatusText] = useState<{ text: string; isError: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  // In case of editing, pre-fill form
  useEffect(() => {
    if (editingMatch) {
      setPlayedAt(formatDateForInput(editingMatch.playedAt));
      const sortedParts = [...editingMatch.participants].sort((a, b) => a.rank - b.rank);
      const sIds = sortedParts.map(p => p.playerId);
      setSelectedIds(sIds);

      const winner = sortedParts.find(p => p.rank === 1);
      if (winner && winner.finishType) {
        setWinnerFinish(winner.finishType);
      }

      const lScores: Record<number, string> = {};
      sortedParts.forEach(p => {
        if (p.rank > 1 && p.scoreLeft !== null) {
          lScores[p.playerId] = String(p.scoreLeft);
        }
      });
      setScoresLeft(lScores);
    } else {
      setPlayedAt("");
      setSelectedIds([]);
      setScoresLeft({});
      setWinnerFinish("SIMPLE");
    }
  }, [editingMatch]);

  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const togglePlayerSelection = (playerId: number) => {
    setSelectedIds(prev => {
      const idx = prev.indexOf(playerId);
      if (idx > -1) {
        // Remove player, cleanup scoreleft
        const raw = [...prev];
        raw.splice(idx, 1);
        const nextScores = { ...scoresLeft };
        delete nextScores[playerId];
        setScoresLeft(nextScores);
        return raw;
      } else {
        // Append player
        return [...prev, playerId];
      }
    });
  };

  const handleScoreChange = (playerId: number, value: string) => {
    // Only accept numbers
    const clean = value.replace(/[^0-9]/g, "");
    setScoresLeft(prev => ({
      ...prev,
      [playerId]: clean
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length < 2) {
      setStatusText({ text: "Veuillez sélectionner au moins 2 joueurs (1 vainqueur + 1 survivant)", isError: true });
      return;
    }

    const winnerId = selectedIds[0];
    const survivors = selectedIds.slice(1);

    // Verify survivors have entered a score
    let hasScoreErrors = false;
    const losersPayload: { playerId: number; scoreLeft: number }[] = [];

    survivors.forEach(id => {
      const sVal = scoresLeft[id];
      const sNum = Number(sVal);
      if (!sVal || isNaN(sNum) || sNum <= 0 || sNum > 301) {
        hasScoreErrors = true;
      } else {
        losersPayload.push({
          playerId: id,
          scoreLeft: sNum
        });
      }
    });

    if (hasScoreErrors) {
      setStatusText({ text: "Chaque survivant doit avoir un score restant valide entre 1 et 301 points", isError: true });
      return;
    }

    setLoading(true);
    setStatusText(null);

    // Auto-detect season based on playedAt
    const matchDate = playedAt ? new Date(playedAt) : new Date();
    const matchDateStr = matchDate.toISOString();

    const activeSeason = seasons.find(s => {
      const start = new Date(s.startedAt);
      const end = s.endedAt ? new Date(s.endedAt) : null;
      return start <= matchDate && (!end || end >= matchDate);
    });

    if (!activeSeason) {
      setStatusText({ text: "Aucune saison active trouvée correspondante à cette date. Créez une saison d'abord.", isError: true });
      setLoading(false);
      return;
    }

    try {
      // Pull career XP before match
      const allPlayerCareerXPs = dbStore.getMatches().reduce((map, m) => {
        m.participants.forEach(p => {
          map.set(p.playerId, (map.get(p.playerId) || 0) + p.xpEarned);
        });
        return map;
      }, new Map<number, number>());

      const winnerCareerXPBefore = allPlayerCareerXPs.get(winnerId) || 0;
      const loserXPsBeforeMap = new Map<number, number>();
      survivors.forEach(id => {
        loserXPsBeforeMap.set(id, allPlayerCareerXPs.get(id) || 0);
      });

      // Count consecutive wins
      const consecutiveWins = countConsecutiveWinsBefore(
        winnerId,
        activeSeason.id,
        matches,
        matchDateStr,
        editingMatch?.id
      );

      const calculatedParticipants = calculateMatchResults(
        winnerId,
        winnerFinish,
        losersPayload,
        winnerCareerXPBefore,
        loserXPsBeforeMap,
        activeSeason,
        consecutiveWins
      );

      let savedMatch: Match;
      if (editingMatch) {
        // Admin password required for update checks
        savedMatch = await dbStore.updateMatch(editingMatch.id, {
          seasonId: activeSeason.id,
          playedAt: matchDateStr,
          participants: calculatedParticipants
        });
        setEditingMatch(null);
        setStatusText({ text: "Match mis à jour avec succès !", isError: false });
      } else {
        savedMatch = await dbStore.recordMatch({
          seasonId: activeSeason.id,
          playedAt: matchDateStr,
          participants: calculatedParticipants
        });
        setStatusText({ text: "Match enregistré avec succès !", isError: false });
      }

      // Cleanup selection
      setSelectedIds([]);
      setScoresLeft({});
      setWinnerFinish("DOUBLE");
      onMatchRecorded(savedMatch);
    } catch (err: any) {
      setStatusText({ text: err.message || "Une erreur est survenue", isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Sort players alphabetically for user panel selection
  const sortedPlayersList = [...players].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111114] border border-[#2A2A2E] rounded-none box-glow">
        <h2 className="text-xl font-bold font-display text-white tracking-wide uppercase">
          {editingMatch ? `✏️ Modifier le match #${editingMatch.id}` : "⚔️ Enregistrer un match terminé"}
        </h2>
        <p className="text-xs text-slate-400 mt-1">Saisissez les résultats de la bataille 301. Le premier sélectionné est le vainqueur !</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date override element */}
        <div className="bg-[#111114]/80 border border-[#2A2A2E] p-4 rounded-none flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex items-center gap-2 text-slate-300">
            <Calendar className="w-4 h-4 text-cosmic-accent" />
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Date et heure du match (Optionnel)</label>
          </div>
          <input
            type="datetime-local"
            value={playedAt}
            onChange={(e) => setPlayedAt(e.target.value)}
            className="bg-slate-950 border border-[#2A2A2E] text-xs text-slate-300 px-3 py-2 rounded-none focus:border-cosmic-accent/60 focus:outline-none w-full md:w-56"
          />
          {editingMatch && (
            <button
              type="button"
              onClick={() => setEditingMatch(null)}
              className="md:ml-auto px-4 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-slate-300 rounded-none cursor-pointer"
            >
              Annuler la modification
            </button>
          )}
        </div>

        {/* Players Quick Tapping Block */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">1. Sélectionner les Participants</h3>
            <p className="text-xs text-slate-[#55555F]">Cliquez sur un joueur pour l'associer. Le tout premier sélectionné remporte le match 🏆.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 select-none">
            {sortedPlayersList.map(p => {
              const selectedIndex = selectedIds.indexOf(p.id);
              const isSelected = selectedIndex > -1;
              const isWinner = selectedIndex === 0;

              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => togglePlayerSelection(p.id)}
                  className={`p-3 rounded-none border flex flex-col items-center justify-center text-center gap-1.5 transition cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 ${
                    isWinner
                      ? "bg-amber-500/10 border-amber-500 text-amber-200 shadow-md shadow-amber-500/5 font-bold"
                      : isSelected
                      ? "bg-cosmic-accent/15 border-cosmic-accent text-white font-extrabold"
                      : "bg-[#111114]/50 border-[#2A2A2E]/60 hover:border-[#2A2A2E] hover:bg-[#111114]/80 text-slate-400"
                  }`}
                >
                  <div className="w-10 h-10 rounded-none bg-slate-950 flex items-center justify-center text-lg shadow-inner relative border border-[#2A2A2E]/50">
                    {isWinner ? (
                      <span className="text-amber-400 font-bold">🏆</span>
                    ) : isSelected ? (
                      <span className="text-cosmic-accent font-black font-mono">{selectedIndex + 1}</span>
                    ) : (
                      <div className="w-10 h-10 rounded-none bg-slate-950 border border-[#2A2A2E] group-hover:border-cosmic-accent group-hover:text-cosmic-accent flex items-center justify-center text-slate-400 font-bold select-none shrink-0 font-display transition-all">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold truncate w-full select-text">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected participants details input */}
        {selectedIds.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-display">2. Renseigner les Détails du Finish</h3>

            <div className="bg-[#111114] border border-[#2A2A2E] rounded-none divide-y divide-[#2A2A2E]/60 animate-fadeIn">
              {selectedIds.map((id, index) => {
                const p = players.find(x => x.id === id);
                if (!p) return null;
                const isWinner = index === 0;

                return (
                  <div key={id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isWinner ? "bg-amber-500/[0.02]" : ""}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-slate-950 border border-[#2A2A2E] flex items-center justify-center text-sm font-bold">
                        {isWinner ? "🏆" : "💀"}
                      </div>
                      <div>
                        <span className="font-semibold text-white select-text">{p.name}</span>
                        <span className="block text-[10px] text-slate-450 font-mono tracking-wider">
                          Position {index + 1} · {isWinner ? "Vainqueur du match" : "Survivant de l'arène"}
                        </span>
                      </div>
                    </div>

                    {isWinner ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-450 font-medium">Type de fermeture :</span>
                        <select
                          value={winnerFinish}
                          onChange={(e) => setWinnerFinish(e.target.value as FinishType)}
                          className="bg-slate-950 border border-[#2A2A2E] text-xs text-slate-300 px-3 py-1.5 rounded-none focus:border-cosmic-accent/60 focus:outline-none cursor-pointer font-bold"
                        >
                          <option value="SIMPLE">🎯 SIMPLE (x1)</option>
                          <option value="DOUBLE">✖️2 DOUBLE (x2)</option>
                          <option value="TRIPLE">✖️3 TRIPLE (x3)</option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-450 font-medium font-sans">Score restant au compteur :</span>
                        <input
                          type="text"
                          required
                          value={scoresLeft[id] || ""}
                          onChange={(e) => handleScoreChange(id, e.target.value)}
                          placeholder="ex: 45"
                          className="bg-slate-950 border border-[#2A2A2E] text-slate-300 text-xs text-center w-20 px-2 py-1.5 rounded-none focus:border-cosmic-accent/60 focus:outline-none font-mono font-bold"
                        />
                        <span className="text-xs text-slate-500">/ 301</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Form Alerts & Submits */}
        <div className="space-y-4">
          <AnimatePresence>
            {statusText && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className={`p-4 rounded-none border flex items-center gap-2.5 text-xs ${
                  statusText.isError
                    ? "bg-red-500/10 border-red-500/35 text-red-300"
                    : "bg-emerald-500/10 border-emerald-500/35 text-emerald-300"
                }`}
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="font-semibold">{statusText.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading || selectedIds.length < 2}
            className={`w-full py-4 rounded-none font-extrabold uppercase tracking-widest font-display select-none transition transform hover:-translate-y-0.5 active:translate-y-0 text-xs border flex items-center justify-center gap-2 cursor-pointer ${
              selectedIds.length < 2
                ? "bg-slate-950 text-slate-600 border-[#2A2A2E] pointer-events-none"
                : "bg-gradient-to-r from-cosmic-accent to-[#8E1E1E] hover:from-cosmic-accent/90 hover:to-[#8E1E1E]/90 text-white border-cosmic-accent/30 shadow-lg shadow-cosmic-accent/15"
            }`}
          >
            <Save className="w-4 h-4" />
            {loading ? "Enregistrement..." : editingMatch ? "Enregistrer les modifications" : "Enregistrer le match"}
          </button>
        </div>
      </form>
    </div>
  );
}
