import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Shield, Users, Trophy, Star, ChevronDown, Check, Lock } from "lucide-react";
import { Player, Guild, Match, Season, GuildWithStats, GuildMemberWithStats, GuildAchievement } from "../types";
import { calculateGuildRank } from "../scoring";
import { dbStore } from "../dbStore";

interface GuildsTabProps {
  players: Player[];
  seasons: Season[];
  matches: Match[];
  onGuildsUpdated: () => void;
  onShowToast: (msg: string, type: "ok" | "err" | "info") => void;
  onShowConfirm: (msg: string) => Promise<boolean>;
  activeSeasonId: number | "";
}

export default function GuildsTab({
  players,
  seasons,
  matches,
  onGuildsUpdated,
  onShowToast,
  onShowConfirm,
  activeSeasonId
}: GuildsTabProps) {
  // Guild Form States
  const [editingGuildId, setEditingGuildId] = useState<number | null>(null);
  const [guildName, setGuildName] = useState("");
  const [badgeIcon, setBadgeIcon] = useState("🛡️");
  const [badgeColor, setBadgeColor] = useState("#3dc7ff");
  const [statusMsg, setStatusMsg] = useState("");

  const [guildsWithStats, setGuildsWithStats] = useState<GuildWithStats[]>([]);

  // Compute stats dynamically inside guilds
  useEffect(() => {
    // 1. Gather active season level, wins and details for every player
    const playerStatsMap = new Map<number, { xp: number; wins: number; badgesCount: number; uniqueBadges: string[] }>();
    
    // Default stats representing current season
    players.forEach(p => {
      playerStatsMap.set(p.id, { xp: 0, wins: 0, badgesCount: 0, uniqueBadges: [] });
    });

    matches.forEach(m => {
      // Filter matches by current active season if activeSeasonId is provided
      if (activeSeasonId !== "" && m.seasonId !== activeSeasonId) return;

      m.participants.forEach(part => {
        const stats = playerStatsMap.get(part.playerId) || { xp: 0, wins: 0, badgesCount: 0, uniqueBadges: [] };
        const uniqueBonusSet = new Set([...stats.uniqueBadges, ...part.medals]);
        playerStatsMap.set(part.playerId, {
          xp: stats.xp + part.xpEarned,
          wins: stats.wins + (part.rank === 1 ? 1 : 0),
          badgesCount: stats.badgesCount + part.medals.length,
          uniqueBadges: Array.from(uniqueBonusSet)
        });
      });
    });

    const list = dbStore.getGuilds();
    const formatted: GuildWithStats[] = list.map(g => {
      const roster: GuildMemberWithStats[] = g.memberIds.map(memId => {
        const pData = players.find(x => x.id === memId);
        const pStats = playerStatsMap.get(memId) || { xp: 0, wins: 0, badgesCount: 0, uniqueBadges: [] };
        
        return {
          id: memId,
          name: pData?.name || `Joueur #${memId}`,
          totalXP: Math.max(0, pStats.xp),
          totalBadgesCount: pStats.badgesCount,
          totalWins: pStats.wins,
          uniqueBadges: pStats.uniqueBadges
        } as any; // Cast for now, dynamic rank evaluated below
      });

      // Find highest XP in guild to allocate Divinité du Triple or Maître Suprême
      const maxXP = roster.length > 0 ? Math.max(...roster.map(r => r.totalXP)) : 0;

      // Map interior ranks for each member
      const sortedRoster: GuildMemberWithStats[] = roster.map((mem: any) => {
        const isHighest = mem.totalXP === maxXP && maxXP > 0;
        const rankInfo = calculateGuildRank(mem.totalXP, mem.totalBadgesCount, mem.uniqueBadges, isHighest);
        return {
          id: mem.id,
          name: mem.name,
          totalXP: mem.totalXP,
          totalBadgesCount: mem.totalBadgesCount,
          totalWins: mem.totalWins,
          guildRank: rankInfo.title,
          guildRankIcon: rankInfo.icon,
          guildRankSlug: rankInfo.slug
        };
      }).sort((a,b) => b.totalXP - a.totalXP);

      const collectiveXP = sortedRoster.reduce((sum, m) => sum + m.totalXP, 0);
      const collectiveWins = sortedRoster.reduce((sum, m) => sum + m.totalWins, 0);
      const hasGiantMember = sortedRoster.some(m => m.totalXP >= 5000);

      // Achievements
      const achievements: GuildAchievement[] = [
        {
          id: "apprentices",
          title: "Apprentis de la Fléchette",
          icon: "🥉",
          description: "XP collective >= 500 XP",
          unlocked: collectiveXP >= 500
        },
        {
          id: "champions",
          title: "Champions en Devenir",
          icon: "🥈",
          description: "XP collective >= 2 000 XP",
          unlocked: collectiveXP >= 2000
        },
        {
          id: "legends",
          title: "Légendes Vivantes",
          icon: "🥇",
          description: "XP collective >= 10 000 XP",
          unlocked: collectiveXP >= 10000
        },
        {
          id: "conquerors",
          title: "Conquérants",
          icon: "⚔️",
          description: "Cumul victoires individuelles >= 10",
          unlocked: collectiveWins >= 10
        },
        {
          id: "giants-den",
          title: "Tanière des Géants",
          icon: "🐉",
          description: "Au moins un membre avec un niveau Maître (XP >= 5000)",
          unlocked: hasGiantMember
        }
      ];

      return {
        id: g.id,
        name: g.name,
        badgeIcon: g.badgeIcon,
        badgeColor: g.badgeColor,
        createdAt: g.createdAt,
        members: sortedRoster,
        memberCount: sortedRoster.length,
        collectiveXP,
        collectiveWins,
        achievements
      };
    });

    // Rank Alliances based on Total collective XP
    formatted.sort((a,b) => b.collectiveXP - a.collectiveXP);
    setGuildsWithStats(formatted);
  }, [players, matches]);

  const [loading, setLoading] = useState(false);

  const handleCreateOrUpdateGuild = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = guildName.trim();
    const cleanIcon = badgeIcon.trim();
    const cleanColor = badgeColor.trim();

    if (!cleanName || !cleanIcon || !cleanColor || loading) return;

    setLoading(true);
    setStatusMsg("");
    try {
      if (editingGuildId !== null) {
        await dbStore.updateGuild(editingGuildId, {
          name: cleanName,
          badgeIcon: cleanIcon,
          badgeColor: cleanColor
        });
        onShowToast("Guilde modifiée avec succès ! ✓", "ok");
        setEditingGuildId(null);
      } else {
        await dbStore.createGuild({
          name: cleanName,
          badgeIcon: cleanIcon,
          badgeColor: cleanColor
        });
        onShowToast("Guilde créée avec succès ! ✓", "ok");
      }
      resetForm();
      onGuildsUpdated();
    } catch (err: any) {
      setStatusMsg(err.message || "Erreur lors de la validation");
    } finally {
      setLoading(false);
    }
  };

  const handleRecruitMember = async (guildId: number, playerIdStr: string) => {
    if (!playerIdStr || loading) return;
    const playerId = Number(playerIdStr);

    setLoading(true);
    try {
      await dbStore.joinGuild(guildId, playerId);
      onShowToast("Recrutement réussi ! ✓", "ok");
      onGuildsUpdated();
    } catch (err: any) {
      onShowToast(err.message || "Erreur de recrutement", "err");
    } finally {
      setLoading(false);
    }
  };

  const handleExcludeMember = async (guildId: number, playerId: number, playerName: string) => {
    if (loading) return;
    const ok = await onShowConfirm(`Voulez-vous vraiment exclure "${playerName}" de l'alliance ?`);
    if (!ok) return;

    setLoading(true);
    try {
      await dbStore.leaveGuild(guildId, playerId);
      onShowToast("Membre exclu de la guilde !", "info");
      onGuildsUpdated();
    } catch (err: any) {
      onShowToast(err.message || "Erreur", "err");
    } finally {
      setLoading(false);
    }
  };

  const handleEditGuild = (g: Guild) => {
    setEditingGuildId(g.id);
    setGuildName(g.name);
    setBadgeIcon(g.badgeIcon);
    setBadgeColor(g.badgeColor);
    setStatusMsg("");
    document.getElementById("guild-form-container")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDeleteGuild = async (id: number, name: string) => {
    if (loading) return;
    const ok = await onShowConfirm(`Voulez-vous vraiment dissoudre l'alliance "${name}" ? Cette action est définitive.`);
    if (!ok) return;

    setLoading(true);
    try {
      await dbStore.deleteGuild(id);
      onShowToast("Alliance dissoute !", "info");
      onGuildsUpdated();
    } catch (err: any) {
      onShowToast(err.message || "Erreur", "err");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingGuildId(null);
    setGuildName("");
    setBadgeIcon("🛡️");
    setBadgeColor("#3dc7ff");
    setStatusMsg("");
  };

  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111114] border border-[#2A2A2E] rounded-none box-glow">
        <h2 className="text-xl font-bold font-display text-white tracking-wide uppercase">🛡️ Guildes & Alliances</h2>
        <p className="text-xs text-slate-400 mt-1">Créez des alliances, recrutez des joueurs, débloquez des exploits collectifs et dominez le panthéon.</p>
      </div>

      {/* Alliance Rank Table */}
      {guildsWithStats.length > 0 && (
        <div className="bg-[#111114] border border-[#2A2A2E] rounded-none shadow-lg p-5 space-y-4">
          <h3 className="text-sm font-bold font-display text-white tracking-wider flex items-center gap-1.5 uppercase select-none">
            <Trophy className="w-4 h-4 text-amber-500" />
            Classement des Alliances ({guildsWithStats.length})
          </h3>
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left font-mono divide-y divide-[#2A2A2E]/60 leading-normal">
              <thead>
                <tr className="bg-slate-950 text-slate-400 text-[10px] uppercase font-display select-none">
                  <th className="py-2.5 px-3 w-12 text-center">Rang</th>
                  <th className="py-2.5 px-3">Alliance</th>
                  <th className="py-2.5 px-3 text-right">XP Collectif</th>
                  <th className="py-2.5 px-3">Membres Associés</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2E]/40">
                {guildsWithStats.map((gl, i) => {
                  return (
                    <tr key={gl.id} className="hover:bg-[#16161A] transition">
                      <td className="py-3 px-3 font-semibold text-slate-450 text-center">{i + 1}</td>
                      <td className="py-3 px-3 flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-none flex items-center justify-center text-sm shadow animate-pulse"
                          style={{ backgroundColor: `${gl.badgeColor}20`, color: gl.badgeColor, border: `1px solid ${gl.badgeColor}35` }}
                        >
                          {gl.badgeIcon}
                        </span>
                        <strong className="text-white font-sans font-bold select-text">{gl.name}</strong>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-400 text-sm">{gl.collectiveXP} XP</td>
                      <td className="py-3 px-3 text-slate-400 font-sans leading-relaxed text-[11px] select-text">
                        {gl.members.map(m => `${m.name} (${m.totalXP} XP)`).join(", ") || "Aucun participant actif"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guild creation form */}
      <div id="guild-form-container" className="bg-[#111114] border border-[#2A2A2E] p-5 rounded-none">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-display mb-4 flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-cosmic-accent" />
          {editingGuildId !== null ? "✏️ Éditer l'Alliance" : "⚡ Fonder une Guilde"}
        </h3>

        <form onSubmit={handleCreateOrUpdateGuild} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nom de la Guilde</label>
              <input
                type="text"
                required
                maxLength={64}
                value={guildName}
                onChange={(e) => setGuildName(e.target.value)}
                placeholder="ex: Les Seigneurs du Bully 🎯"
                className="bg-slate-950 border border-[#2A2A2E] text-xs text-slate-300 px-4 py-3 rounded-none focus:border-cosmic-accent/60 focus:outline-none placeholder:text-slate-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Badge Émoji</label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={badgeIcon}
                  onChange={(e) => setBadgeIcon(e.target.value)}
                  className="bg-slate-950 border border-[#2A2A2E] text-center text-lg text-slate-300 px-3 py-2.5 rounded-none focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Couleur Thème</label>
                <div className="relative flex items-center h-[42px] bg-slate-950 border border-[#2A2A2E] rounded-none overflow-hidden">
                  <input
                    type="color"
                    required
                    value={badgeColor}
                    onChange={(e) => setBadgeColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div
                    className="w-5 h-5 rounded-none border border-white/20 mx-auto"
                    style={{ backgroundColor: badgeColor }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 flex-wrap justify-between items-center pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span>Prévisualisation :</span>
              <span
                className="px-2.5 py-1 rounded-none border font-bold flex items-center gap-1.5 shadow"
                style={{ backgroundColor: `${badgeColor}15`, borderColor: `${badgeColor}40`, color: badgeColor }}
              >
                <span>{badgeIcon}</span>
                <span>{guildName || "Nom de la Guilde"}</span>
              </span>
            </div>

            <div className="flex gap-2">
              {editingGuildId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-slate-800 hover:border-slate-700 bg-slate-900 text-xs text-slate-440 hover:text-slate-200 rounded-none cursor-pointer"
                >
                  Annuler
                </button>
              )}
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-cosmic-accent to-[#8E1E1E] hover:from-cosmic-accent/90 hover:to-[#8E1E1E]/90 text-white font-extrabold uppercase tracking-widest text-xs rounded-none border border-cosmic-accent/30 cursor-pointer shadow transform hover:-translate-y-0.5 active:translate-y-0 shadow-cosmic-accent/10 transition"
              >
                {editingGuildId !== null ? "Mettre à jour" : "Créer le clan"}
              </button>
            </div>
          </div>

          {statusMsg && (
            <p className="text-xs font-semibold text-red-400 py-1">{statusMsg}</p>
          )}
        </form>
      </div>

      {/* GUILD CARDS BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {guildsWithStats.length > 0 ? (
          guildsWithStats.map(gl => {
            const availableRecruits = players.filter(p => !gl.members.some(m => m.id === p.id));

            return (
              <div
                key={gl.id}
                className="bg-[#111114] border border-[#2A2A2E] rounded-none overflow-hidden shadow-xl flex flex-col relative"
                style={{ borderTop: `4px solid ${gl.badgeColor}` }}
              >
                {/* Decorative glowing overlay */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-4 shadow-2xl"
                  style={{
                    background: `radial-gradient(ellipse at top right, ${gl.badgeColor}0d, transparent)`
                  }}
                />

                {/* Header card segment */}
                <div className="p-4 bg-slate-950/40 border-b border-[#2A2A2E]/40 flex justify-between items-start gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-10 h-10 rounded-none flex items-center justify-center text-xl shadow"
                      style={{ backgroundColor: `${gl.badgeColor}15`, border: `1px solid ${gl.badgeColor}40`, color: gl.badgeColor }}
                    >
                      {gl.badgeIcon}
                    </span>
                    <div>
                      <h4 className="font-bold text-white text-base select-text">{gl.name}</h4>
                      <span className="block text-[10px] text-slate-400 font-sans">
                        {gl.members.length} compagnon(s) · <span className="text-emerald-400 font-extrabold text-[11px]">{gl.collectiveXP.toLocaleString()} XP d'Alliance</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={() => handleEditGuild(gl)}
                      className="p-1 px-2.5 text-[9px] uppercase font-bold text-slate-400 hover:text-white border border-slate-800 hover:border-[#2A2A2E] bg-slate-900 rounded-none cursor-pointer transition flex items-center gap-1"
                    >
                      <Edit className="w-3 h-3 text-cosmic-accent" />
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDeleteGuild(gl.id, gl.name)}
                      className="p-1 px-2 text-[9px] uppercase font-bold text-red-500 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-none cursor-pointer transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Dissoudre
                    </button>
                  </div>
                </div>

                {/* Body details container */}
                <div className="p-5 flex-1 flex flex-col gap-5">
                  {/* achievements segment */}
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-500 animate-pulse" />
                      Hauts Faits Collectifs
                    </h5>
                    <div className="flex flex-wrap gap-2 pt-1 font-sans">
                      {gl.achievements.map(ach => {
                        return (
                          <span
                             key={ach.id}
                             className={`p-1.5 px-2 rounded-none text-[10px] border flex items-center gap-1 shrink-0 ${
                               ach.unlocked
                                 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-305 font-bold"
                                 : "bg-slate-950/40 border-[#2A2A2E]/50 text-slate-600 line-through decoration-slate-700 font-semibold"
                             }`}
                             title={ach.description}
                          >
                            <span>{ach.icon}</span>
                            <span>{ach.title}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* roster listings segment */}
                  <div className="space-y-2 border-t border-[#2A2A2E]/40 pt-4 flex-1">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 select-none">
                      <Users className="w-3 h-3 text-cosmic-accent" />
                      Compagnons de Rangs
                    </h5>
                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                      {gl.members.length > 0 ? (
                        gl.members.map(m => {
                          return (
                            <div key={m.id} className="flex justify-between items-center hover:bg-[#16161A] p-1 rounded-none transition-colors text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-sm" title={m.guildRank}>{m.guildRankIcon}</span>
                                <div>
                                  <strong className="text-white select-text font-serif">{m.name}</strong>
                                  <span className="block text-[10px] text-[#88888e] leading-none mt-0.5">
                                    {m.guildRank} · <span className="text-emerald-400 font-bold">{m.totalXP.toLocaleString()} XP</span>
                                  </span>
                                </div>
                              </div>

                              <button
                                onClick={() => handleExcludeMember(gl.id, m.id, m.name)}
                                className="p-1 text-slate-550 hover:text-red-400 shrink-0 cursor-pointer rounded-none hover:bg-red-500/5 transition"
                                title="Exclure ce compagnon"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-500 italic text-center py-4 font-semibold">Aucun compagnon. Recrutez ci-dessous !</p>
                      )}
                    </div>
                  </div>

                  {/* recruitment selector dropdown */}
                  <div className="border-t border-[#2A2A2E]/40 pt-4">
                    {availableRecruits.length > 0 ? (
                      <div className="relative flex items-center w-full">
                        <select
                          value=""
                          onChange={(e) => handleRecruitMember(gl.id, e.target.value)}
                          className="bg-slate-950 border border-[#2A2A2E] hover:border-cosmic-accent/30 text-slate-300 font-bold text-xs px-3 py-2 rounded-none focus:outline-none w-full cursor-pointer pr-8 font-sans"
                        >
                          <option value="">➕ Recruter un joueur...</option>
                          {availableRecruits.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 pointer-events-none" />
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 text-center font-extrabold uppercase">Tous les joueurs de la ligue ont déjà rejoint l'alliance.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-1 md:col-span-2 p-8 bg-[#111114]/50 border border-[#2A2A2E] rounded-none text-center text-slate-400 text-xs select-none font-semibold">
            Aucune guilde n'a encore été construite. Fondez la toute première guilde grâce au configurateur ci-dessus !
          </div>
        )}
      </div>
    </div>
  );
}
