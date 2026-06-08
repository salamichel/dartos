import React, { useState } from "react";
import { UserPlus, Edit3, Award, Star, Eye } from "lucide-react";
import { Player, Match, Guild, Season } from "../types";
import { getLevel, getMedalIcon, getMedalTitle } from "../scoring";
import { dbStore } from "../dbStore";
import PlayerDetailModal from "./PlayerDetailModal";

interface PlayersTabProps {
  players: Player[];
  matches: Match[];
  guilds: Guild[];
  seasons: Season[];
  isAdmin?: boolean;
  onPlayersUpdated: () => void;
  onShowToast: (msg: string, type: "ok" | "err" | "info") => void;
}

export default function PlayersTab({
  players,
  matches,
  guilds,
  seasons,
  isAdmin = false,
  onPlayersUpdated,
  onShowToast
}: PlayersTabProps) {
  const [newPlayerName, setNewPlayerName] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newPlayerName.trim();
    if (!cleanName || loading) return;

    setLoading(true);
    setStatusMsg("");
    try {
      await dbStore.createPlayer(cleanName);
      setNewPlayerName("");
      onShowToast("Joueur créé avec succès ! ✓", "ok");
      onPlayersUpdated();
    } catch (err: any) {
      setStatusMsg(err.message || "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  const handleRenamePlayer = async (id: number, currentName: string) => {
    if (loading) return;
    const val = prompt(`Entrez le nouveau pseudo pour "${currentName}" :`, currentName);
    if (val === null) return;
    const cleanName = val.trim();
    if (!cleanName || cleanName === currentName) return;

    setLoading(true);
    try {
      await dbStore.updatePlayer(id, cleanName);
      onShowToast("Pseudo mis à jour ! ✓", "ok");
      onPlayersUpdated();
    } catch (err: any) {
      onShowToast(err.message || "Erreur lors de la modification", "err");
    } finally {
      setLoading(false);
    }
  };

  // Find current active season
  const activeSeason = seasons.find(s => {
    const now = new Date();
    const start = new Date(s.startedAt);
    const end = s.endedAt ? new Date(s.endedAt) : null;
    return start <= now && (!end || end >= now);
  }) || (seasons.length > 0 ? seasons[0] : null);

  // Group player statistics (active season XP and cumulative badges)
  const playersWithDetails = players.map(p => {
    // Collect XP (for active season only) and medals won by this player (career or season? task says "il ne faut pas afficher les xptotal mais ceux de la saison en cours" - we will compute seasonXP)
    let totalXP = 0; // career XP for level calculation
    let seasonXP = 0; // XP of current active season
    const badgesGroup: Record<string, number> = {};

    matches.forEach(m => {
      const part = m.participants.find(pt => pt.playerId === p.id);
      if (part) {
        totalXP += part.xpEarned;
        if (activeSeason && m.seasonId === activeSeason.id) {
          seasonXP += part.xpEarned;
        }
        part.medals.forEach(medal => {
          badgesGroup[medal] = (badgesGroup[medal] || 0) + 1;
        });
      }
    });

    totalXP = Math.max(0, totalXP);
    seasonXP = Math.max(0, seasonXP);
    const levelInfo = getLevel(totalXP);

    return {
      ...p,
      totalXP,
      seasonXP,
      levelTitle: levelInfo.title,
      medals: Object.entries(badgesGroup).map(([name, count]) => ({ name, count }))
    };
  });

  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111114] border border-[#2A2A2E] rounded-none box-glow">
        <h2 className="text-xl font-bold font-display text-white tracking-wide uppercase">👤 Gestion des Joueurs</h2>
        <p className="text-xs text-slate-400 mt-1">Gérer la composition de votre ligue et inspecter les carrières individuelles.</p>
      </div>

      {/* Creation form */}
      <form onSubmit={handleCreatePlayer} className="bg-[#111114] border border-[#2A2A2E] p-5 rounded-none flex flex-col md:flex-row gap-4 items-stretch md:items-center">
        <div className="flex-1 flex flex-col gap-1.55">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Nom du Compagnon</label>
          <input
            type="text"
            required
            maxLength={64}
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="ex: Lancelot_Du_301 🎯"
            className="bg-slate-950 border border-[#2A2A2E] text-xs text-slate-300 px-4 py-3 rounded-none focus:border-cosmic-accent/60 focus:outline-none placeholder:text-slate-650"
          />
        </div>
        
        <div className="flex flex-col gap-1.5 md:self-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-cosmic-accent to-[#8E1E1E] hover:from-cosmic-accent/90 hover:to-[#8E1E1E]/90 text-white font-extrabold uppercase tracking-widest text-xs rounded-none border border-cosmic-accent/30 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-cosmic-accent/10 transition transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            <UserPlus className="w-4 h-4" />
            {loading ? "Création..." : "Ajouter le Joueur"}
          </button>
        </div>

        {statusMsg && (
          <p className="text-xs font-semibold text-red-400 self-center md:self-end py-2">{statusMsg}</p>
        )}
      </form>

      {/* Players List */}
      <div className="bg-[#111114] border border-[#2A2A2E] rounded-none overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950 border-b border-[#2A2A2E]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display">Membres Actifs ({players.length})</h3>
        </div>

        <ul className="divide-y divide-[#2A2A2E]/60" id="players-tab-list">
          {playersWithDetails.length > 0 ? (
            playersWithDetails.map(p => {
              return (
                <li
                  key={p.id}
                  id={`player-row-${p.id}`}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#16161A] transition-colors group/row"
                >
                  <div
                    id={`player-row-clickable-${p.id}`}
                    onClick={() => setSelectedPlayer({ id: p.id, name: p.name, createdAt: p.createdAt })}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer flex-1 group"
                    title="Cliquez pour inspecter la carrière du joueur"
                  >
                    <div className="w-10 h-10 rounded-none bg-slate-950 border border-[#2A2A2E] group-hover:border-cosmic-accent group-hover:text-cosmic-accent flex items-center justify-center text-slate-400 font-bold select-none shrink-0 font-display transition-all">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-white group-hover:text-cosmic-accent text-base select-text font-semibold transition-colors flex items-center gap-1.5">
                          {p.name}
                          <Eye className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                        </strong>
                        <span className="px-2.5 py-0.5 border border-cosmic-accent/20 bg-cosmic-accent/10 text-cosmic-accent text-[10px] rounded-none font-bold">
                          {p.levelTitle}
                        </span>
                      </div>
                      
                      <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-emerald-400">
                          {p.seasonXP.toLocaleString()} XP
                        </span>
                        <span className="text-[10px] text-slate-500">
                          ({activeSeason ? activeSeason.name : "Saison en cours"})
                        </span>
                        
                        {/* Grouped Medals Display */}
                        {p.medals.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[#66666E] text-[10px] uppercase font-mono tracking-wider">Médailles :</span>
                            {p.medals.map(m => (
                              <span
                                key={m.name}
                                className="px-1.5 py-0.5 bg-slate-950 border border-[#2A2A2E] text-[10px] rounded-none font-mono select-none flex items-center gap-1 shrink-0 cursor-help"
                                title={getMedalTitle(m.name)}
                              >
                                {getMedalIcon(m.name)}
                                {m.count > 1 && <span className="text-slate-405 font-bold font-mono text-[9px]">×{m.count}</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      id={`inspect-player-btn-${p.id}`}
                      onClick={() => setSelectedPlayer({ id: p.id, name: p.name, createdAt: p.createdAt })}
                      className="p-2 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-[#2A2A2E] rounded-none cursor-pointer transition flex items-center gap-1 text-xs"
                      title="Inspecter le profil"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="sr-only sm:not-sr-only text-[10px] font-bold uppercase tracking-wider pr-1">Fiche</span>
                    </button>
                    <button
                      id={`rename-player-btn-${p.id}`}
                      onClick={() => handleRenamePlayer(p.id, p.name)}
                      className="p-2 bg-slate-950 hover:bg-slate-900 text-cosmic-accent hover:text-[#FF6E6E] border border-[#2A2A2E] rounded-none cursor-pointer transition"
                      title="Renommer le pseudo"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })
          ) : (
            <li className="p-8 text-center text-slate-400 text-xs font-semibold">
              Aucun joueur n'a encore été créé. Utilisez le formulaire ci-dessus.
            </li>
          )}
        </ul>
      </div>

      {/* Player Detail Modal Integration */}
      <PlayerDetailModal
        player={selectedPlayer}
        isOpen={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
        matches={matches}
        players={players}
        guilds={guilds}
        seasons={seasons}
        isAdmin={isAdmin}
      />
    </div>
  );
}
