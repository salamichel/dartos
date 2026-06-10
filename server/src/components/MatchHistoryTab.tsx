import { useState, useEffect } from "react";
import { Filter, Calendar, RefreshCw, Trash2, Edit } from "lucide-react";
import { Match, Season, Player } from "../types";
import { getMedalIcon, getMedalTitle } from "../scoring";

interface MatchHistoryTabProps {
  players: Player[];
  seasons: Season[];
  matches: Match[];
  onDeleteMatch: (id: number) => void;
  onEditMatch: (m: Match) => void;
}

export default function MatchHistoryTab({
  players,
  seasons,
  matches,
  onDeleteMatch,
  onEditMatch
}: MatchHistoryTabProps) {
  const [filterSeasonId, setFilterSeasonId] = useState<number | "">("");
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (filterSeasonId === "") {
      setFilteredMatches(matches);
    } else {
      setFilteredMatches(matches.filter(m => m.seasonId === filterSeasonId));
    }
  }, [matches, filterSeasonId]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 bg-[#111114] border border-[#2A2A2E] rounded-none gap-4 box-glow">
        <div>
          <h2 className="text-xl font-bold font-display text-white tracking-wide uppercase">📜 Historique des Matchs</h2>
          <p className="text-xs text-slate-400 mt-1">Revoir l'ensemble des parties terminées et les médailles attribuées.</p>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-cosmic-accent shrink-0" />
          <select
            value={filterSeasonId}
            onChange={(e) => setFilterSeasonId(e.target.value === "" ? "" : Number(e.target.value))}
            className="bg-slate-950 border border-[#2A2A2E] text-slate-300 font-bold text-xs px-3 py-2 rounded-none focus:border-cosmic-accent/60 focus:outline-none cursor-pointer w-full md:w-52"
          >
            <option value="">📋 Filtrer par toutes les saisons</option>
            {seasons.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* MATCH CARDS GRID */}
      {filteredMatches.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredMatches.map(m => {
            const seasonName = seasons.find(s => s.id === m.seasonId)?.name || "Saison Inconnue";
            // Sort participants: rank ascending
            const sortedParticipants = [...m.participants].sort((a,b) => a.rank - b.rank);

            return (
              <div
                key={m.id}
                className="bg-[#111114] border border-[#2A2A2E] rounded-none overflow-hidden shadow-md flex flex-col divide-y divide-[#2A2A2E]/50 relative hover:border-cosmic-accent/30 transition-all duration-350"
              >
                {/* Header segment with Match info */}
                <div className="p-4 bg-slate-950 flex justify-between items-center flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cosmic-accent font-mono tracking-wide">MATCH #{m.id}</span>
                    <span className="text-slate-600">•</span>
                    <span className="px-2 py-0.5 bg-slate-900 border border-[#2A2A2E] text-slate-300 font-bold rounded-none text-[10px]">
                      {seasonName}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400 flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 opacity-60 text-cosmic-accent" />
                      {formatDate(m.playedAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={() => onEditMatch(m)}
                      className="p-1 px-2.5 text-[10px] uppercase font-bold tracking-wider text-cosmic-accent bg-cosmic-accent/5 hover:bg-cosmic-accent/10 border border-cosmic-accent/20 hover:text-white rounded-none cursor-pointer transition flex items-center gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      Modifier
                    </button>
                    <button
                      onClick={() => onDeleteMatch(m.id)}
                      className="p-1 px-2 text-[10px] uppercase font-bold tracking-wider text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 border border-red-500/25 rounded-none cursor-pointer transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Supprimer
                    </button>
                  </div>
                </div>

                {/* Score listing segments */}
                <div className="p-4 bg-slate-950/20">
                  <ul className="space-y-3 font-mono">
                    {sortedParticipants.map(part => {
                      const pPlayer = players.find(x => x.id === part.playerId);
                      const pName = pPlayer?.name || `Joueur #${part.playerId}`;
                      const isWinner = part.rank === 1;

                      return (
                        <li key={part.playerId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                          {/* Left segment */}
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-none select-none font-black flex items-center justify-center text-[10px] border ${
                              isWinner
                                ? "bg-amber-500/15 border-amber-500/35 text-amber-400"
                                : "bg-slate-950 border-[#2A2A2E] text-slate-450"
                            }`}>
                              {isWinner ? "🏆" : part.rank}
                            </span>
                            <div>
                              <span className="font-bold text-white text-sm select-text font-sans">{pName}</span>
                              <span className="inline-block sm:hidden text-[10px] text-slate-500 ml-2">
                                {isWinner ? `Félicitations ! Fermeture ${part.finishType}` : `Reste ${part.scoreLeft} pts`}
                              </span>
                            </div>
                            <span className="hidden sm:inline-block text-[10px] text-slate-400 font-normal">
                              {isWinner ? `· Fermeture ${part.finishType}` : `· Reste ${part.scoreLeft} pt(s)`}
                            </span>
                          </div>

                          {/* Right segment (XP and badges) */}
                          <div className="flex items-center gap-2 flex-wrap self-end sm:self-center font-sans">
                            <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 font-black font-mono text-xs rounded-none border border-emerald-505/20">
                              +{part.xpEarned} XP
                            </span>
                            {part.medals && part.medals.length > 0 && (
                              <div className="flex items-center gap-1">
                                {part.medals.map(medal => (
                                  <span
                                    key={medal}
                                    className="p-1 px-1.5 bg-slate-950 border border-[#2A2A2E] hover:border-[#2A2A2E] text-xs rounded-none select-none flex items-center gap-1 shrink-0 filter brightness-110 cursor-help"
                                    title={getMedalTitle(medal)}
                                  >
                                    <span className="text-xs leading-none">{getMedalIcon(medal)}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 bg-[#111114]/50 border border-[#2A2A2E] rounded-none text-center text-slate-400 select-none font-semibold text-xs">
          Aucun match enregistré pour l'instant.
        </div>
      )}
    </div>
  );
}
