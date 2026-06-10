import React from "react";
import { X, Award, Swords, Zap, Sparkles, Flame, Percent, Target, Skull, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Player, Match, Guild, Season } from "../types";
import { getLevel, getMedalIcon, getMedalTitle, LEVELS } from "../scoring";

interface PlayerDetailModalProps {
  player: Player | null;
  isOpen: boolean;
  onClose: () => void;
  matches: Match[];
  players: Player[];
  guilds: Guild[];
  seasons: Season[];
  isAdmin?: boolean;
}

export default function PlayerDetailModal({
  player,
  isOpen,
  onClose,
  matches,
  players,
  guilds,
  seasons,
  isAdmin = false
}: PlayerDetailModalProps) {
  const [selectedSeasonIds, setSelectedSeasonIds] = React.useState<number[]>([]);

  // Synchronize state when open and player changes
  React.useEffect(() => {
    if (player) {
      // Find seasons where player played at least once
      const playedIds = new Set<number>();
      matches.forEach(m => {
        if (m.participants.some(p => p.playerId === player.id) && m.seasonId) {
          playedIds.add(m.seasonId);
        }
      });
      if (playedIds.size === 0) {
        setSelectedSeasonIds(seasons.map(s => s.id));
      } else {
        setSelectedSeasonIds(Array.from(playedIds));
      }
    }
  }, [player, matches, seasons]);

  if (!isOpen || !player) return null;

  // 1. Filter matching stats
  const playerMatches = matches
    .filter(m => m.participants.some(p => p.playerId === player.id))
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()); // newest first

  const totalMatchesCount = playerMatches.length;

  // Find current active season
  const activeSeason = seasons.find(s => {
    const now = new Date();
    const start = new Date(s.startedAt);
    const end = s.endedAt ? new Date(s.endedAt) : null;
    return start <= now && (!end || end >= now);
  }) || (seasons.length > 0 ? seasons[0] : null);

  // Let's compute career XP, active season XP, wins, medals
  let totalXP = 0;
  let seasonXP = 0;
  let winsCount = 0;
  let maxSingleMatchXP = 0;
  const medalsCountMap: Record<string, number> = {};
  const rankCountMap: Record<number, number> = {};
  const finishTypesCount: Record<string, number> = { SIMPLE: 0, DOUBLE: 0, TRIPLE: 0 };

  // Track rival matches (matches where both played)
  // We want to find who beat who, and total faceoffs
  const faceoffsMap: Record<number, { playedTogether: number; rivalBeatsPlayer: number; playerBeatsRival: number }> = {};

  playerMatches.forEach(m => {
    const selfPart = m.participants.find(p => p.playerId === player.id);
    if (selfPart) {
      totalXP += selfPart.xpEarned;
      if (activeSeason && m.seasonId === activeSeason.id) {
        seasonXP += selfPart.xpEarned;
      }
      if (selfPart.rank === 1) {
        winsCount++;
        const finish = selfPart.finishType || "SIMPLE";
        finishTypesCount[finish] = (finishTypesCount[finish] || 0) + 1;
      }
      if (selfPart.xpEarned > maxSingleMatchXP) {
        maxSingleMatchXP = selfPart.xpEarned;
      }

      rankCountMap[selfPart.rank] = (rankCountMap[selfPart.rank] || 0) + 1;

      // Group medals
      selfPart.medals.forEach(medal => {
        medalsCountMap[medal] = (medalsCountMap[medal] || 0) + 1;
      });

      // Look at faceoffs with other players in this match
      m.participants.forEach(other => {
        if (other.playerId === player.id) return;
        
        if (!faceoffsMap[other.playerId]) {
          faceoffsMap[other.playerId] = { playedTogether: 0, rivalBeatsPlayer: 0, playerBeatsRival: 0 };
        }
        
        const f = faceoffsMap[other.playerId];
        f.playedTogether += 1;
        if (other.rank < selfPart.rank) {
          f.rivalBeatsPlayer += 1;
        } else if (other.rank > selfPart.rank) {
          f.playerBeatsRival += 1;
        }
      });
    }
  });

  const levelInfo = getLevel(totalXP);
  const nextLevelIdx = LEVELS.findIndex(l => l.minXP > totalXP);
  const nextLevel = nextLevelIdx > -1 ? LEVELS[nextLevelIdx] : null;

  // Compute XP progress percentage
  let xpProgressPercent = 100;
  let xpRemainingToNext = 0;
  if (nextLevel) {
    const currentMin = levelInfo.minXP;
    const range = nextLevel.minXP - currentMin;
    const progress = totalXP - currentMin;
    xpProgressPercent = Math.min(100, Math.floor((progress / range) * 105));
    xpRemainingToNext = nextLevel.minXP - totalXP;
  }

  const winRate = totalMatchesCount > 0 ? Math.round((winsCount / totalMatchesCount) * 100) : 0;
  const avgXpPerMatch = totalMatchesCount > 0 ? Math.round(totalXP / totalMatchesCount) : 0;

  // Determine favorite target / rival metrics
  let nemesisPlayer: Player | null = null;
  let nemesisBeatsCount = 0;
  let favoriteOpponent: Player | null = null;
  let favoriteOpponentCount = 0;

  Object.entries(faceoffsMap).forEach(([rivalIdStr, f]) => {
    const rivalId = Number(rivalIdStr);
    const rData = players.find(p => p.id === rivalId);
    if (!rData) return;

    if (f.rivalBeatsPlayer > nemesisBeatsCount) {
      nemesisBeatsCount = f.rivalBeatsPlayer;
      nemesisPlayer = rData;
    }
    if (f.playedTogether > favoriteOpponentCount) {
      favoriteOpponentCount = f.playedTogether;
      favoriteOpponent = rData;
    }
  });

  // Recent 5 matches form helper
  const recentForm = playerMatches.slice(0, 5).map(m => {
    const selfSec = m.participants.find(p => p.playerId === player.id)!;
    const date = new Date(m.playedAt);
    return {
      matchId: m.id,
      rank: selfSec.rank,
      xpEarned: selfSec.xpEarned,
      medals: selfSec.medals,
      finishType: selfSec.finishType,
      dateFormatted: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
    };
  });

  // Guild info
  const playerGuild = guilds.find(g => g.memberIds.includes(player.id));

  return (
    <div
      id="player-detail-overlay-bg"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto"
    >
      <motion.div
        id="player-detail-modal-container"
        initial={{ opacity: 0, scale: 0.95, y: -15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -15 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-2xl bg-slate-900 border-2 border-slate-800 rounded-none shadow-2xl relative flex flex-col my-2 sm:my-8 overflow-hidden"
      >
        {/* Glow Header Accent Line */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-cosmic-accent via-[#FF6E6E] to-[#8E1E1E]" />

        {/* Modal Close Button */}
        <button
          id="player-detail-close-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-950 border border-slate-805 text-slate-400 hover:text-white transition rounded-lg hover:border-slate-700 cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Hero Area */}
        <div id="player-detail-hero-box" className="p-6 pt-8 pb-5 bg-gradient-to-b from-[#111114] to-transparent border-b border-[#2A2A2E]/50 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 rounded-none bg-slate-950 border-2 border-cosmic-accent flex items-center justify-center text-white text-3xl font-black font-display shrink-0 shadow-[0_0_15px_rgba(255,62,62,0.15)]">
            {player.name.charAt(0).toUpperCase()}
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="player-detail-name-heading" className="text-2xl font-black text-white hover:text-cosmic-accent transition uppercase tracking-tight select-text">
                {player.name}
              </h2>
              {playerGuild && (
                <span
                  id={`player-detail-guild-tag-${playerGuild.id}`}
                  className="px-2.5 py-0.5 text-[10px] rounded-none font-bold text-white border filter brightness-110"
                  style={{
                    backgroundColor: `${playerGuild.badgeColor}25`,
                    borderColor: `${playerGuild.badgeColor}40`,
                    color: playerGuild.badgeColor
                  }}
                >
                  {playerGuild.badgeIcon} {playerGuild.name}
                </span>
              )}
            </div>

            <div className="flex gap-2.5 items-center flex-wrap">
              <span id="player-detail-tier-badge" className="inline-block px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider border text-cosmic-accent bg-cosmic-accent/10 border-cosmic-accent/20 rounded-none">
                {levelInfo.title}
              </span>
              <span id="player-detail-season-xp-indicator" className="text-sm text-emerald-400 font-mono font-black bg-slate-950 px-2.5 py-1 border border-[#2A2A2E] shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                {seasonXP.toLocaleString()} XP ({activeSeason ? activeSeason.name : "Saison en cours"})
              </span>
              <span id="player-detail-xp-indicator" className="text-sm text-emerald-500/80 font-mono font-semibold">
                {totalXP.toLocaleString()} XP Totale (Carrière)
              </span>
            </div>
          </div>
        </div>

        {/* Tab content / Bento Stats */}
        <div id="player-detail-content-scroll" className="p-6 overflow-y-auto space-y-6 max-h-[70vh]">
          {/* Level Progress Gauge */}
          <div id="player-detail-level-progress-box" className="bg-slate-950 border border-slate-805 p-4 rounded-none space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-400">Progression de Niveau</span>
              <span className="font-mono text-slate-400">
                {nextLevel ? `${xpRemainingToNext} XP avant ${nextLevel.title}` : "Rang Absolu Max ! 🔥"}
              </span>
            </div>
            
            <div className="w-full bg-slate-900 h-3 border border-slate-800 rounded-none overflow-hidden p-[2px]">
              <div
                id="player-detail-progress-fill"
                style={{ width: `${xpProgressPercent}%` }}
                className="h-full bg-gradient-to-r from-cosmic-accent to-[#8E1E1E] transition-all duration-500 shadow-[0_0_8px_rgba(255,62,62,0.4)]"
              />
            </div>
          </div>

          {/* Core Performance Grid */}
          <div id="player-detail-metrics-grid" className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div id="metric-box-matches" className="bg-[#111114] border border-[#2A2A2E] p-4 text-center rounded-none relative overflow-hidden group">
              <Swords className="w-4 h-4 text-slate-500 absolute top-3 right-3 opacity-60 group-hover:scale-110 transition-transform" />
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-display">Matchs Joués</div>
              <div className="text-2xl font-black text-white font-mono mt-1">
                {isAdmin ? totalMatchesCount : "🔒"}
              </div>
            </div>

            <div id="metric-box-winrate" className="bg-[#111114] border border-[#2A2A2E] p-4 text-center rounded-none relative overflow-hidden group">
              <Percent className="w-4 h-4 text-slate-500 absolute top-3 right-3 opacity-60 group-hover:scale-110 transition-transform" />
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-display">Taux de Victoires</div>
              <div className="text-2xl font-black text-cosmic-accent font-mono mt-1">{winRate}%</div>
            </div>

            <div id="metric-box-avgxp" className="bg-[#111114] border border-[#2A2A2E] p-4 text-center rounded-none relative overflow-hidden group">
              <Zap className="w-4 h-4 text-slate-500 absolute top-3 right-3 opacity-60 group-hover:scale-110 transition-transform" />
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-display">XP Moyenne / Match</div>
              <div className="text-2xl font-black text-white font-mono mt-1">{avgXpPerMatch}</div>
            </div>

            <div id="metric-box-maxxp" className="bg-[#111114] border border-[#2A2A2E] p-4 text-center rounded-none relative overflow-hidden group">
              <Flame className="w-4 h-4 text-slate-500 absolute top-3 right-3 opacity-60 group-hover:scale-110 transition-transform" />
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-display">Record XP Unico</div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-1">{maxSingleMatchXP}</div>
            </div>
          </div>

          {/* Win Rate Progression Line Chart */}
          {seasons.length > 0 && (() => {
            const sortedSeasons = [...seasons].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
            const activeSelectedSeasons = sortedSeasons.filter(s => selectedSeasonIds.includes(s.id));
            const chartData = activeSelectedSeasons.map(s => {
              const seasonMatches = matches.filter(m => m.seasonId === s.id);
              const playerSeasonMatches = seasonMatches.filter(m => m.participants.some(p => p.playerId === player.id));
              const total = playerSeasonMatches.length;
              const wins = playerSeasonMatches.filter(m => m.participants.some(p => p.playerId === player.id && p.rank === 1)).length;
              const rate = total > 0 ? Math.round((wins / total) * 100) : 0;
              return {
                name: s.name,
                "Taux de Victoires": rate,
                totalMatches: total,
                wins: wins
              };
            });

            return (
              <div id="player-win-rate-chart-card" className="bg-[#111114] border border-[#2A2A2E] p-4 rounded-none space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-display font-semibold">
                      <TrendingUp className="w-4 h-4 text-cosmic-accent" /> Évolution du Ratio de Victoire
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Suivez les performances au fil des saisons sélectionnées. Cliquez pour filtrer la liste :
                    </p>
                  </div>
                </div>

                {/* Toggle season pill buttons */}
                <div id="chart-season-filters" className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-905">
                  {sortedSeasons.map((s) => {
                    const isVisible = selectedSeasonIds.includes(s.id);
                    const isPlayed = matches.some(m => m.seasonId === s.id && m.participants.some(p => p.playerId === player.id));
                    return (
                      <button
                        key={s.id}
                        id={`chart-filter-season-${s.id}`}
                        onClick={() => {
                          if (isVisible) {
                            setSelectedSeasonIds(prev => prev.filter(x => x !== s.id));
                          } else {
                            setSelectedSeasonIds(prev => [...prev, s.id]);
                          }
                        }}
                        className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer border transition-all flex items-center gap-1.5 rounded-none ${
                          isVisible
                            ? "bg-slate-950 text-white border-cosmic-accent"
                            : "bg-slate-950/20 text-slate-500 border-[#2A2A2E] hover:text-slate-400 hover:border-slate-850"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 shrink-0 ${isVisible ? "bg-cosmic-accent" : "bg-slate-600"}`} />
                        {s.name} {!isPlayed && " (0 m)"}
                      </button>
                    );
                  })}
                </div>

                {chartData.length > 0 ? (
                  <div id="player-chart-container-inner" className="h-[180px] w-full pt-1 select-none">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 15, left: -25, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" />
                        <XAxis dataKey="name" stroke="#55555c" fontSize={9} />
                        <YAxis stroke="#55555c" fontSize={9} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#111114", borderColor: "#2A2A2E", borderRadius: "0px" }}
                          itemStyle={{ fontSize: 10, padding: 0 }}
                          labelStyle={{ fontSize: 10, fontWeight: "bold", color: "#FF3E3E", marginBottom: 3 }}
                          formatter={(value, name, props) => {
                            const payload = props.payload;
                            return [`${value}% (${payload.wins}/${payload.totalMatches} matches)`, name];
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="Taux de Victoires"
                          stroke="#FF3E3E"
                          strokeWidth={2.5}
                          dot={{ r: 4, stroke: "#111114", strokeWidth: 1.5, fill: "#FF3E3E" }}
                          activeDot={{ r: 6, strokeWidth: 1, fill: "#FF3E3E" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic text-center py-4">Sélectionnez au moins une saison pour afficher l'évolution.</p>
                )}
              </div>
            );
          })()}

          {/* Placements and Closing Stats */}
          <div id="player-detail-placements-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Placements stats */}
            <div id="placements-card" className="bg-[#111114] border border-[#2A2A2E] p-4 rounded-none space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-1.5 font-display">
                <Target className="w-3.5 h-3.5 text-cosmic-accent" /> Placements en Arena
              </h3>
              <div className="space-y-2.5 text-xs">
                {[1, 2, 3, 4].map(rank => {
                  const rCount = rankCountMap[rank] || 0;
                  const pct = totalMatchesCount > 0 ? Math.round((rCount / totalMatchesCount) * 100) : 0;
                  const isGold = rank === 1;

                  return (
                    <div key={rank} className="space-y-1">
                      <div className="flex justify-between items-center text-[11px] font-mono">
                        <span className="font-semibold text-slate-400">
                          {rank === 1 ? "🏆 1er (Victoire)" : `${rank}e Position`}
                        </span>
                        <span className="text-slate-300 font-bold">
                          {isAdmin ? `${rCount} fois` : "🔒"} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-none overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full ${isGold ? "bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.5)]" : "bg-slate-700"}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Closing preferences & Rivals */}
            <div id="closing-rivals-card" className="bg-[#111114] border border-[#2A2A2E] p-4 rounded-none space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-1.5 font-display">
                  <Award className="w-3.5 h-3.5 text-cosmic-accent" /> Styles de Fermeture
                </h3>
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div className="bg-slate-950 p-2.5 border border-slate-850">
                    <span className="block text-[10px] text-slate-400 font-mono font-semibold uppercase tracking-wider">Simple</span>
                    <strong className="block text-base text-slate-200 mt-1">
                      {isAdmin ? (finishTypesCount.SIMPLE || 0) : "🔒"}
                    </strong>
                  </div>
                  <div className="bg-slate-950 p-2.5 border border-amber-500/10">
                    <span className="block text-[10px] text-amber-350 font-mono font-semibold uppercase tracking-wider">Double</span>
                    <strong className="block text-base text-amber-400 mt-1">
                      {isAdmin ? (finishTypesCount.DOUBLE || 0) : "🔒"}
                    </strong>
                  </div>
                  <div className="bg-slate-950 p-2.5 border border-cosmic-accent/10">
                    <span className="block text-[10px] text-cosmic-accent font-mono font-semibold uppercase tracking-wider">Triple</span>
                    <strong className="block text-base text-cosmic-accent mt-1">
                      {isAdmin ? (finishTypesCount.TRIPLE || 0) : "🔒"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Competitive Relationships */}
              <div className="border-t border-slate-800/60 pt-3 mt-3">
                <span className="block text-[10px] uppercase font-bold tracking-widest text-[#66666E] font-display">Rivalités célèbres</span>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[9.5px]">Némésis Récurrente :</span>
                    <strong className="text-white">
                      {nemesisPlayer ? `${nemesisPlayer.name} (${isAdmin ? `${nemesisBeatsCount} défaites` : "🔒"})` : "Aucun rival direct"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9.5px]">Cochambre d'entraînement :</span>
                    <strong className="text-white">
                      {favoriteOpponent ? `${favoriteOpponent.name} (${isAdmin ? `${favoriteOpponentCount} matchs` : "🔒"})` : "Solo Dartos"}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Gamified Achievements/Medals Portfolio */}
          <div id="medals-card-box" className="bg-[#111114] border border-[#2A2A2E] p-4 rounded-none space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-1.5 font-display">
              <Sparkles className="w-4 h-4 text-cosmic-accent" /> Médailles & Badges Collectionnés
            </h3>

            {Object.keys(medalsCountMap).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                {Object.entries(medalsCountMap).map(([mName, count]) => (
                  <div key={mName} className="flex items-center gap-2.5 bg-slate-950 p-2.5 border border-slate-850 hover:border-slate-800 transition">
                    <span className="text-2xl filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] select-none shrink-0">
                      {getMedalIcon(mName)}
                    </span>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-white leading-tight">
                          {getMedalTitle(mName)}
                        </span>
                        <span className="px-1.5 py-0.2 bg-cosmic-accent/10 border border-cosmic-accent/20 text-cosmic-accent font-bold font-mono text-[9px] rounded-sm shrink-0">
                          x{count}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block leading-tight">
                        Aggregé sur l'ensemble des saisons de ligue.
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-450 italic py-2 text-center text-slate-400">Aucun badge ou médaille enregistré pour l'instant. Lancez des fléchettes ! 🎯</p>
            )}
          </div>

          {/* Recent Form Lineup */}
          <div id="recent-form-box" className="bg-[#111114] border border-[#2A2A2E] p-4 rounded-none space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-1.5 font-display">
              <ClockIcon className="w-3.5 h-3.5 text-cosmic-accent" /> Historique de Forme (Recents)
            </h3>

            {recentForm.length > 0 ? (
              <div className="space-y-2.5">
                {recentForm.map((m, idx) => {
                  const isWin = m.rank === 1;
                  return (
                    <div
                      key={m.matchId}
                      className={`p-3 bg-slate-950 border flex items-center justify-between text-xs transition-colors hover:bg-slate-900/30 ${
                        isWin ? "border-amber-500/15" : "border-slate-850"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-md font-bold font-mono select-none text-[10px] flex items-center justify-center border ${
                          isWin
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse"
                            : "bg-slate-900 border-slate-805 text-slate-400"
                        }`}>
                          {isWin ? "🏆" : m.rank}
                        </span>
                        <div>
                          <span className="text-slate-300 font-bold block">
                            Match #{m.matchId} · {m.dateFormatted}
                          </span>
                          <div className="flex gap-1.5 items-center flex-wrap pt-0.5">
                            {m.finishType && (
                              <span className="text-[8px] uppercase tracking-wider font-extrabold text-amber-400 bg-amber-500/5 px-1 rounded border border-amber-500/10">
                                Close : {m.finishType}
                              </span>
                            )}
                            {m.medals.map(med => (
                              <span
                                key={med}
                                className="px-1 text-[9px] bg-slate-900 border border-slate-800 font-mono text-slate-300"
                                title={getMedalTitle(med)}
                              >
                                {getMedalIcon(med)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="font-mono font-black text-right text-emerald-400 text-sm">
                        +{m.xpEarned} XP
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-450 italic py-2 text-center text-slate-400">Aucun match enregistré pour ce joueur pour le moment.</p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div id="player-detail-modal-footer" className="p-4 bg-slate-950 border-t border-[#2A2A2E]/50 text-right">
          <button
            id="player-detail-footer-close-button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 rounded-none border border-slate-800 transition cursor-pointer"
          >
            Fermer le Profil
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Simple clock SVG icon definition to avoid missing imports in custom react builds
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
