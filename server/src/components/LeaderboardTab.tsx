import { useState, useEffect } from "react";
import { Trophy, RefreshCw, Layers, Calculator, Play, Info, HelpCircle, TrendingUp, Eye } from "lucide-react";
import { motion } from "motion/react";
import { Player, Season, Match, Guild } from "../types";
import { LEVELS, getLevel, getLevelIndex, getMedalIcon, getMedalTitle, isPalindrome } from "../scoring";
import PlayerDetailModal from "./PlayerDetailModal";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

const LINE_COLORS = [
  "#FF3E3E", // Cosmic Red
  "#3b82f6", // Blue
  "#10b981", // Emerald Green
  "#a855f7", // Purple
  "#eab308", // Amber
  "#67e8f9", // Cyan
  "#f472b6", // Pink
  "#fb923c"  // Orange
];

interface LeaderboardTabProps {
  players: Player[];
  seasons: Season[];
  matches: Match[];
  guilds: Guild[];
  selectedSeasonId: number | "";
  setSelectedSeasonId: (id: number | "") => void;
  onRecalculateSeason: (id: number) => void;
  isAdmin?: boolean;
}

export default function LeaderboardTab({
  players,
  seasons,
  matches,
  guilds,
  selectedSeasonId,
  setSelectedSeasonId,
  onRecalculateSeason,
  isAdmin = false
}: LeaderboardTabProps) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [timerText, setTimerText] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [visiblePlayers, setVisiblePlayers] = useState<string[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<number | "none" | "">("");

  // Pre-seed visible players on chart to be the top 4
  useEffect(() => {
    if (leaderboard.length > 0) {
      const topNames = leaderboard.slice(0, 4).map(p => p.name);
      setVisiblePlayers(topNames);
    }
  }, [leaderboard]);

  // Ticking Season countdown timer
  useEffect(() => {
    const activeSeason = seasons.find(s => s.id === selectedSeasonId);
    if (!activeSeason || !activeSeason.endedAt) {
      setTimerText(selectedSeasonId ? "Pas de date de fin définie" : "");
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(activeSeason.endedAt!).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimerText(`Saison "${activeSeason.name}" terminée.`);
        clearInterval(interval);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let parts = [];
      if (days > 0) parts.push(`${days}j`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      setTimerText(`Termine dans : ${parts.join(" ")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedSeasonId, seasons]);

  // Compute leaderboard based on selectedSeasonId
  useEffect(() => {
    let result: any[] = [];

    if (selectedSeasonId !== "") {
      // Seasonspecific leaderboard
      const map = new Map<number, { xp: number; wins: number; matchesCount: number }>();
      const seasonMatches = matches.filter(m => m.seasonId === selectedSeasonId);

      seasonMatches.forEach(m => {
        m.participants.forEach(p => {
          const prev = map.get(p.playerId) || { xp: 0, wins: 0, matchesCount: 0 };
          map.set(p.playerId, {
            xp: prev.xp + p.xpEarned,
            wins: prev.wins + (p.rank === 1 ? 1 : 0),
            matchesCount: prev.matchesCount + 1
          });
        });
      });

      players.forEach(p => {
        const stats = map.get(p.id) || { xp: 0, wins: 0, matchesCount: 0 };
        // Don't show players with 0 matches in season leaderboard to keep it relevant
        if (stats.matchesCount > 0) {
          const pg = guilds.find(g => g.memberIds.includes(p.id));
          result.push({
            id: p.id,
            name: p.name,
            totalXP: Math.max(0, stats.xp),
            matchesPlayed: stats.matchesCount,
            wins: stats.wins,
            guild: pg ? { name: pg.name, badgeIcon: pg.badgeIcon, badgeColor: pg.badgeColor } : null
          });
        }
      });
    } else {
      // Global leaderboard (All XP career)
      const map = new Map<number, { xp: number; wins: number; matchesCount: number }>();
      matches.forEach(m => {
        m.participants.forEach(p => {
          const prev = map.get(p.playerId) || { xp: 0, wins: 0, matchesCount: 0 };
          map.set(p.playerId, {
            xp: prev.xp + p.xpEarned,
            wins: prev.wins + (p.rank === 1 ? 1 : 0),
            matchesCount: prev.matchesCount + 1
          });
        });
      });

      players.forEach(p => {
        const stats = map.get(p.id) || { xp: 0, wins: 0, matchesCount: 0 };
        const pg = guilds.find(g => g.memberIds.includes(p.id));
        result.push({
          id: p.id,
          name: p.name,
          totalXP: Math.max(0, stats.xp),
          matchesPlayed: stats.matchesCount,
          wins: stats.wins,
          guild: pg ? { name: pg.name, badgeIcon: pg.badgeIcon, badgeColor: pg.badgeColor } : null
        });
      });
    }

    // Filter by guild if selected
    if (selectedGuildId !== "") {
      if (selectedGuildId === "none") {
        result = result.filter(row => !guilds.some(g => g.memberIds.includes(row.id)));
      } else {
        const targetGuild = guilds.find(g => g.id === selectedGuildId);
        const memberIds = targetGuild ? targetGuild.memberIds : [];
        result = result.filter(row => memberIds.includes(row.id));
      }
    }

    // Sort descending by totalXP, then by wins, then by name
    result.sort((a, b) => {
      if (b.totalXP !== a.totalXP) return b.totalXP - a.totalXP;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name);
    });

    setLeaderboard(result);
  }, [players, matches, guilds, selectedSeasonId, selectedGuildId]);

  const levelColors: Record<string, string> = {
    "Pousse-Caillou": "bg-slate-800/60 text-slate-300 border-slate-700/40",
    "Lanceur du Dimanche": "bg-emerald-500/10 text-emerald-305 border-emerald-500/20",
    "Sniper de Comptoir": "bg-cosmic-accent/10 text-cosmic-accent border-cosmic-accent/20",
    "Maître du 301": "bg-purple-500/10 text-purple-300 border-purple-500/20",
    "Phil Taylor": "bg-amber-500/15 text-amber-205 border-amber-500/30 animate-pulse"
  };

  const levelSlugs: Record<string, string> = {
    "Pousse-Caillou": "pousse-caillou",
    "Lanceur du Dimanche": "lanceur-dimanche",
    "Sniper de Comptoir": "sniper-comptoir",
    "Maître du 301": "maitre-301",
    "Phil Taylor": "phil-taylor"
  };

  // Top 3 for Podium modeling
  const podiumSpots = [
    leaderboard[1] || null, // Spot 2 (Left)
    leaderboard[0] || null, // Spot 1 (Center)
    leaderboard[2] || null  // Spot 3 (Right)
  ];

  // Chronological accumulation of XP for Recharts graph representation
  const activeSeasonMatchesForChart = selectedSeasonId !== ""
    ? matches.filter(m => m.seasonId === selectedSeasonId)
    : matches;

  const sortedMatchesForChart = [...activeSeasonMatchesForChart].sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());

  // Setup running stats tracker
  const runningPlayerXPs: Record<number, number> = {};
  players.forEach(p => {
    runningPlayerXPs[p.id] = 0;
  });

  const chartData: any[] = [];
  
  // Starting index 'Début'
  const startPoint: Record<string, any> = { name: "Début" };
  players.forEach(p => {
    startPoint[p.name] = 0;
  });
  chartData.push(startPoint);

  sortedMatchesForChart.forEach((m, idx) => {
    const date = new Date(m.playedAt);
    const dateStr = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    const label = `M${idx + 1} (${dateStr})`;

    m.participants.forEach(p => {
      if (runningPlayerXPs[p.playerId] !== undefined) {
        runningPlayerXPs[p.playerId] += p.xpEarned;
      }
    });

    const point: Record<string, any> = { name: label };
    players.forEach(p => {
      point[p.name] = runningPlayerXPs[p.id] || 0;
    });

    chartData.push(point);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 bg-[#111114] border border-[#2A2A2E] rounded-none gap-4 box-glow">
        <div>
          <h2 className="text-xl font-bold font-display text-white tracking-wide uppercase">🏆 Classements de la Ligue</h2>
          <p className="text-xs text-slate-400 mt-1">L'historique des meilleures performances, individuel et en alliances.</p>
        </div>

        {/* Controllers (Season & Guild Alliance) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Season select */}
          <select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value === "" ? "" : Number(e.target.value))}
            className="bg-slate-950 border border-[#2A2A2E] text-slate-300 font-bold text-xs px-3 py-2 rounded-none focus:border-cosmic-accent/60 focus:outline-none cursor-pointer"
          >
            <option value="">🏆 Saisons Confondues (Général)</option>
            {seasons.map(s => (
              <option key={s.id} value={s.id}>{s.name} {new Date(s.startedAt) <= new Date() && (!s.endedAt || new Date(s.endedAt) >= new Date()) ? "🟢" : "🔒"}</option>
            ))}
          </select>

          {/* Guild select filter */}
          <select
            value={selectedGuildId === "none" ? "none" : selectedGuildId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedGuildId(val === "" ? "" : val === "none" ? "none" : Number(val));
            }}
            className="bg-slate-950 border border-[#2A2A2E] text-slate-350 font-bold text-xs px-3 py-2 rounded-none focus:border-cosmic-accent/60 focus:outline-none cursor-pointer"
          >
            <option value="">🔰 Toutes les Alliances</option>
            {guilds.map(g => (
              <option key={g.id} value={g.id}>
                {g.badgeIcon} {g.name}
              </option>
            ))}
            <option value="none">👤 Sans Alliance</option>
          </select>

          {selectedSeasonId && (
            <button
              onClick={() => onRecalculateSeason(selectedSeasonId)}
              className="px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-[#2A2A2E] text-slate-300 hover:text-white rounded-none text-xs flex items-center gap-1.5 transition cursor-pointer"
              title="Recalculer les scores"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cosmic-accent" />
              Recalculer
            </button>
          )}
        </div>
      </div>

      {/* Countdown Timer Alert */}
      {timerText && (
        <div className="bg-cosmic-accent/10 border border-cosmic-accent/20 px-4 py-2.5 rounded-none text-center select-none shadow-sm shadow-cosmic-accent/5">
          <span className="text-xs font-mono font-medium text-cosmic-accent flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-cosmic-accent rounded-full animate-ping shrink-0" />
            {timerText}
          </span>
        </div>
      )}

      {/* 3D PODIUM */}
      {leaderboard.length > 0 && (
        <div className="pt-2 select-none" id="leaderboard-podium-box">
          <div className="flex items-end justify-center max-w-sm mx-auto h-[180px] gap-2 md:gap-4 font-display">
            {/* 2nd Place (Left) */}
            {podiumSpots[0] && (
              <div
                id="podium-spot-2"
                onClick={() => {
                  const pData = players.find(x => x.id === podiumSpots[0].id);
                  if (pData) setSelectedPlayer(pData);
                }}
                className="flex flex-col items-center flex-1 cursor-pointer group"
                title="Inspecter le profil du joueur"
              >
                <div className="text-2xl mb-1 mt-1 transition-transform group-hover:scale-110">🥈</div>
                <div className="text-xs font-bold text-slate-300 group-hover:text-cosmic-accent text-center truncate max-w-[80px] md:max-w-[110px] select-text transition-colors">
                  {podiumSpots[0].name}
                </div>
                <div className="text-xs font-mono text-emerald-400 font-bold mb-2">
                  {podiumSpots[0].totalXP} XP
                </div>
                <div className="w-full bg-[#111114] border border-[#2A2A2E] group-hover:border-slate-700 rounded-none h-[70px] flex items-center justify-center shadow-lg transition-colors">
                  <span className="text-lg font-bold text-slate-400">2</span>
                </div>
              </div>
            )}

            {/* 1st Place (Center) */}
            {podiumSpots[1] && (
              <motion.div
                id="podium-spot-1"
                initial={{ y: 5 }}
                animate={{ y: 0 }}
                transition={{ repeat: Infinity, duration: 2.5, repeatType: "reverse" }}
                onClick={() => {
                  const pData = players.find(x => x.id === podiumSpots[1].id);
                  if (pData) setSelectedPlayer(pData);
                }}
                className="flex flex-col items-center flex-1 z-10 cursor-pointer group"
                title="Inspecter le profil du Champion du Jour"
              >
                <div className="text-4xl leading-none mb-1 text-center animate-bounce">👑</div>
                <div className="text-sm font-black text-amber-300 group-hover:text-cosmic-accent text-center truncate max-w-[90px] md:max-w-[120px] select-text transition-colors">
                  {podiumSpots[1].name}
                </div>
                <div className="text-sm font-mono text-emerald-400 font-extrabold mb-2">
                  {podiumSpots[1].totalXP} XP
                </div>
                <div className="w-full bg-gradient-to-b from-cosmic-accent/15 to-[#111114] border-2 border-cosmic-accent/40 group-hover:border-cosmic-accent rounded-none h-[100px] flex items-center justify-center shadow-2xl relative transition-colors">
                  {/* Glowing background */}
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cosmic-accent to-transparent" />
                  <span className="text-2xl font-black text-cosmic-accent text-glow">1</span>
                </div>
              </motion.div>
            )}

            {/* 3rd Place (Right) */}
            {podiumSpots[2] && (
              <div
                id="podium-spot-3"
                onClick={() => {
                  const pData = players.find(x => x.id === podiumSpots[2].id);
                  if (pData) setSelectedPlayer(pData);
                }}
                className="flex flex-col items-center flex-1 cursor-pointer group"
                title="Inspecter le profil du joueur"
              >
                <div className="text-2xl mb-1 transition-transform group-hover:scale-110">🥉</div>
                <div className="text-xs font-bold text-slate-400 group-hover:text-cosmic-accent text-center truncate max-w-[80px] md:max-w-[110px] select-text transition-colors">
                  {podiumSpots[2].name}
                </div>
                <div className="text-xs font-mono text-emerald-400 font-bold mb-2">
                  {podiumSpots[2].totalXP} XP
                </div>
                <div className="w-full bg-[#111114] border border-[#2A2A2E]/50 group-hover:border-slate-700 rounded-none h-[55px] flex items-center justify-center shadow-md transition-colors">
                  <span className="text-base font-bold text-slate-500">3</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* XP Progression Line Chart */}
      {sortedMatchesForChart.length > 0 && (
        <div id="leaderboard-chart-card" className="bg-[#111114] border border-[#2A2A2E] p-5 rounded-none space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-display">
                <TrendingUp className="w-4 h-4 text-cosmic-accent animate-pulse" /> 📈 Évolution Chronologique de l'XP
              </h3>
              <p className="text-[10px] text-slate-450 mt-1">
                Visualisez la trajectoire d'XP de chaque lanceur. Cliquez sur les boutons pour afficher/masquer leurs courbes.
              </p>
            </div>
          </div>

          {/* Toggle pill buttons */}
          <div id="chart-player-filters" className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-900/50">
            {leaderboard.map((row) => {
              const originalIndex = players.findIndex(p => p.id === row.id);
              const isVisible = visiblePlayers.includes(row.name);
              const color = LINE_COLORS[originalIndex > -1 ? originalIndex % LINE_COLORS.length : 0];
              return (
                <button
                  key={row.id}
                  id={`chart-filter-p-${row.id}`}
                  onClick={() => {
                    if (isVisible) {
                      setVisiblePlayers(prev => prev.filter(x => x !== row.name));
                    } else {
                      setVisiblePlayers(prev => [...prev, row.name]);
                    }
                  }}
                  className={`px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer border transition-all flex items-center gap-1.5 rounded-none ${
                    isVisible
                      ? "bg-slate-950 text-white shadow-inner"
                      : "bg-slate-950/20 text-slate-500 border-slate-900 hover:text-slate-400 hover:border-slate-800"
                  }`}
                  style={isVisible ? { borderColor: color, color } : undefined}
                >
                  <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: color }} />
                  {row.name}
                </button>
              );
            })}
          </div>

          {/* Responsive Recharts Container */}
          <div id="chart-container-inner" className="h-[250px] w-full pt-1 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 15, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" />
                <XAxis dataKey="name" stroke="#55555c" fontSize={9} />
                <YAxis stroke="#55555c" fontSize={9} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111114", borderColor: "#2A2A2E", borderRadius: "0px" }}
                  itemStyle={{ fontSize: 10, padding: 0 }}
                  labelStyle={{ fontSize: 10, fontWeight: "bold", color: "#FF3E3E", marginBottom: 3 }}
                />
                {players.map((p, index) => {
                  if (!visiblePlayers.includes(p.name)) return null;
                  const color = LINE_COLORS[index % LINE_COLORS.length];
                  return (
                    <Line
                      key={p.id}
                      type="monotone"
                      dataKey={p.name}
                      stroke={color}
                      strokeWidth={2.5}
                      dot={{ r: 3.5, stroke: "#111114", strokeWidth: 1.5 }}
                      activeDot={{ r: 5, strokeWidth: 1 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="bg-[#111114] border border-[#2A2A2E] rounded-none overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-[#2A2A2E] text-[10px] font-semibold tracking-wider text-slate-400 uppercase font-display">
                <th className="py-3.5 px-4 w-12 text-center">Rang</th>
                <th className="py-3.5 px-4">Joueur</th>
                <th className="py-3.5 px-4 w-28 text-right">XP</th>
                <th className="py-3.5 px-4">Progression Niveau</th>
                <th className="py-3.5 px-4 w-40 text-center">Niveau Actuel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2E]/60 text-xs">
              {leaderboard.length > 0 ? (
                leaderboard.map((row, idx) => {
                  const levelInfo = getLevel(row.totalXP);
                  const nextLevelIdx = LEVELS.findIndex(l => l.minXP > row.totalXP);
                  const nextLevel = nextLevelIdx > -1 ? LEVELS[nextLevelIdx] : null;

                  let progressPercent = 100;
                  let xpLabel = "🔥 Rang Absolu Max !";

                  if (nextLevel) {
                    const currentLevelMin = levelInfo.minXP;
                    const range = nextLevel.minXP - currentLevelMin;
                    const currentProgress = row.totalXP - currentLevelMin;
                    progressPercent = Math.min(100, Math.floor((currentProgress / range) * 100));
                    xpLabel = `${nextLevel.minXP - row.totalXP} XP avant ${nextLevel.title}`;
                  }

                  const badgeClass = levelColors[levelInfo.title] || "bg-slate-800";
                  const levelSlug = levelSlugs[levelInfo.title] || "recruit";

                  return (
                    <tr
                      key={row.id}
                      id={`leaderboard-row-${row.id}`}
                      className="hover:bg-[#16161A] transition-colors cursor-pointer group"
                      onClick={() => {
                        const pData = players.find(x => x.id === row.id);
                        if (pData) setSelectedPlayer(pData);
                      }}
                      title="Inspecter le profil et les exploits du joueur"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-center text-[#66666E]">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-white group-hover:text-cosmic-accent text-sm select-text transition-colors flex items-center gap-1.5">
                            {row.name}
                            <Eye className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                          {row.guild && (
                            <span
                              className="px-1.5 py-0.5 text-[9px] rounded-none font-bold text-white border filter brightness-110"
                              style={{
                                backgroundColor: `${row.guild.badgeColor}25`,
                                borderColor: `${row.guild.badgeColor}40`,
                                color: row.guild.badgeColor
                              }}
                              title={`Membre de la guilde Alliance : ${row.guild.name}`}
                            >
                              {row.guild.badgeIcon} {row.guild.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-right font-black text-emerald-400 text-sm">
                        {row.totalXP.toLocaleString()} XP
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="max-w-[200px] md:max-w-xs space-y-1">
                          <div className="w-full bg-slate-950 h-2 rounded-none overflow-hidden border border-[#2A2A2E]">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPercent}%` }}
                              transition={{ duration: 1.2, ease: "easeOut" }}
                              className="h-full bg-gradient-to-r from-cosmic-accent to-[#8E1E1E]"
                            />
                          </div>
                          <span className="block text-[10px] text-slate-400 font-mono tracking-wide">
                            {xpLabel}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-1 text-[10px] font-semibold tracking-wide border rounded-none select-none ${badgeClass}`}>
                          {levelInfo.title}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Aucun match enregistré pour cette saison pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accordion Panels for XP rules and Guild help */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Levels Guide */}
        <details className="bg-[#111114]/80 border border-[#2A2A2E] rounded-none group transition-all duration-300 overflow-hidden">
          <summary className="flex items-center justify-between p-4 font-display font-medium text-xs tracking-wider text-slate-300 uppercase cursor-pointer hover:bg-slate-900/40 list-none select-none">
            <span className="flex items-center gap-1.5 font-bold">
              <Layers className="w-4 h-4 text-cosmic-accent animate-pulse" />
              🛡️ Guide des Rangs et Niveaux
            </span>
            <span className="text-xs text-slate-500 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="p-4 border-t border-[#2A2A2E] bg-slate-950/20 divide-y divide-slate-800/30 text-xs text-slate-300">
            {LEVELS.map((level, i) => {
              const next = LEVELS[i + 1];
              return (
                <div key={level.title} className="py-2.5 flex justify-between items-center">
                  <span className={`px-2 py-0.5 border text-[10px] font-semibold rounded-none ${levelColors[level.title]}`}>
                    {level.title}
                  </span>
                  <span className="font-mono text-slate-450">
                    {next ? `${level.minXP} à ${next.minXP - 1} XP` : `${level.minXP}+ XP`}
                  </span>
                </div>
              );
            })}
          </div>
        </details>

        {/* RPG Scoring Help */}
        <details className="bg-[#111114]/80 border border-[#2A2A2E] rounded-none group transition-all duration-300 overflow-hidden">
          <summary className="flex items-center justify-between p-4 font-display font-medium text-xs tracking-wider text-slate-300 uppercase cursor-pointer hover:bg-slate-900/40 list-none select-none">
            <span className="flex items-center gap-1.5 font-bold">
              <Calculator className="w-4 h-4 text-cosmic-accent" />
              🎯 Formule de l'XP Sudden Death
            </span>
            <span className="text-xs text-slate-500 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="p-4 border-t border-[#2A2A2E] space-y-4 text-xs text-slate-300">
            <div className="space-y-1.5">
              <h4 className="font-bold text-[#FF3E3E] text-xs">🏆 Système RPG Vainqueur (301 Sudden Death)</h4>
              <p className="text-slate-405 leading-relaxed text-[11px]">
                XP = (Contre-adversaires) + (Bonus de Fermeture) + (Somme scores restants x Vampire Mlt) + (Badges d'exploit).
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                <li>Double Fermeture : +50 XP | Triple Fermeture : +100 XP.</li>
                <li>Pondéré par Palier : Diminue si l'adversaire battu est d'un niveau très inférieur (-25% par palier d'écart).</li>
              </ul>
            </div>
            <div className="space-y-1.5 border-t border-slate-800/50 pt-2.5">
              <h4 className="font-bold text-white text-xs">💀 Survivants</h4>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                XP de base + Badges spéciaux :
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-400">
                <li>🥈 <strong>POULIDOR</strong> : +15 XP (finit second, score restant inférieur à 10).</li>
                <li>🎰 <strong>JACKPOT</strong> : +20 XP (finit à un score palindrome : 11, 22, 33, etc.).</li>
                <li>🤝 <strong>ÉGALITÉ</strong> : +10 XP (même score qu'un autre survivant).</li>
                <li>👶 <strong>BENJAMIN</strong> : +15 XP (dernier survivant d'un match à 3+ joueurs, score restant &lt; 50).</li>
              </ul>
            </div>
          </div>
        </details>
      </div>

      {/* Career Details Modal Popover */}
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
