import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Calendar, Settings2, Sliders, ShieldAlert, BadgeInfo } from "lucide-react";
import { Season, XPConfig } from "../types";
import { SEASON_DEFAULTS } from "../scoring";
import { dbStore } from "../dbStore";

interface SeasonsTabProps {
  seasons: Season[];
  onSeasonsUpdated: () => void;
  onShowToast: (msg: string, type: "ok" | "err" | "info") => void;
  onShowConfirm: (msg: string) => Promise<boolean>;
}

export default function SeasonsTab({ seasons, onSeasonsUpdated, onShowToast, onShowConfirm }: SeasonsTabProps) {
  // Season Form States
  const [editingSeasonId, setEditingSeasonId] = useState<number | null>(null);
  const [seasonName, setSeasonName] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");

  const [xpConfig, setXpConfig] = useState<XPConfig>({ ...SEASON_DEFAULTS });
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    resetForm();
  }, [seasons]);

  const resetForm = () => {
    setEditingSeasonId(null);
    setSeasonName("");
    setStartedAt("");
    setEndedAt("");
    setXpConfig({ ...SEASON_DEFAULTS });
    setStatusMsg("");
  };

  const handleEditSeason = (s: Season) => {
    setEditingSeasonId(s.id);
    setSeasonName(s.name);
    setStartedAt(formatDateForInput(s.startedAt));
    setEndedAt(formatDateForInput(s.endedAt || ""));
    setXpConfig({
      xpPerDefeatedOpponent: s.xpPerDefeatedOpponent,
      xpBonusSimple: s.xpBonusSimple,
      xpBonusDouble: s.xpBonusDouble,
      xpBonusTriple: s.xpBonusTriple,
      xpVampireMultiplier: s.xpVampireMultiplier,
      xpSurvivorBase: s.xpSurvivorBase,
      xpBonusPoulidor: s.xpBonusPoulidor,
      xpBonusJackpot: s.xpBonusJackpot,
      xpBonusEgalite: s.xpBonusEgalite,
      xpBonusTueurDeGeants: s.xpBonusTueurDeGeants,
      xpBonusPhenix: s.xpBonusPhenix,
      xpBonusSerialWinner: s.xpBonusSerialWinner,
      xpBonusBenjamin: s.xpBonusBenjamin,
      xpBonusLottery: s.xpBonusLottery,
      bonusVainqueurParRang: s.bonusVainqueurParRang
    });
    setStatusMsg("");
    document.getElementById("season-form-container")?.scrollIntoView({ behavior: "smooth" });
  };

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

  const handleCreateOrUpdateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = seasonName.trim();
    if (!cleanName) return;

    const payload: Omit<Season, "id"> = {
      name: cleanName,
      startedAt: startedAt ? new Date(startedAt).toISOString() : new Date().toISOString(),
      endedAt: endedAt ? new Date(endedAt).toISOString() : null,
      ...xpConfig
    };

    try {
      if (editingSeasonId !== null) {
        const { matchesRecalculated } = await dbStore.updateSeason(editingSeasonId, payload);
        onShowToast(`Saison mise à jour · ${matchesRecalculated} match(s) recalculé(s) ✓`, "ok");
      } else {
        await dbStore.createSeason(payload);
        onShowToast("Saison créée avec succès ! ✓", "ok");
      }
      resetForm();
      onSeasonsUpdated();
    } catch (err: any) {
      setStatusMsg(err.message || "Erreur lors de la validation");
    }
  };

  const handleDeleteSeason = async (id: number, name: string) => {
    const ok = await onShowConfirm(`Êtes-vous absolument sûr de vouloir supprimer la saison "${name}" ? Cette action effacera également TOUT l'historique des matchs correspondants !`);
    if (!ok) return;

    try {
      await dbStore.deleteSeason(id);
      onShowToast("Saison supprimée !", "info");
      onSeasonsUpdated();
    } catch (err: any) {
      onShowToast(err.message || "Erreur de suppression", "err");
    }
  };

  const updateXpConfigParam = (key: keyof XPConfig, value: any) => {
    setXpConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="space-y-6">
      <div className="p-5 bg-[#111114] border border-[#2A2A2E] rounded-none box-glow">
        <h2 className="text-xl font-bold font-display text-white tracking-wide uppercase">🏟️ Configurations des Saisons</h2>
        <p className="text-xs text-slate-400 mt-1">Créez de nouvelles saisons et affinez précisément la distribution de l'XP.</p>
      </div>

      {/* Season Creator/Editor Form */}
      <div id="season-form-container" className="bg-[#111114] border border-[#2A2A2E] p-5 rounded-none space-y-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-display flex items-center gap-1.5 border-b border-[#2A2A2E]/50 pb-3 select-none">
          <Settings2 className="w-4 h-4 text-cosmic-accent animate-spin-slow" />
          {editingSeasonId !== null ? "✏️ Éditer la Saison active" : "➕ Ouvrir une nouvelle Saison"}
        </h3>

        <form onSubmit={handleCreateOrUpdateSeason} className="space-y-6">
          {/* Section 1: Identification & dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5 md:col-span-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identifiant / Nom</label>
              <input
                type="text"
                required
                maxLength={64}
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
                placeholder="ex: Coupe d'Hiver 2026"
                className="bg-slate-950 border border-[#2A2A2E] text-xs text-slate-300 px-4 py-3 rounded-none focus:border-cosmic-accent/60 focus:outline-none placeholder:text-slate-700"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📅 Liaison Début</label>
              <input
                type="datetime-local"
                required
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                className="bg-slate-950 border border-[#2A2A2E] text-xs text-slate-300 px-4 py-2.5 rounded-none focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🏁 Fin de la Saison (Facultatif)</label>
              <input
                type="datetime-local"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
                className="bg-slate-950 border border-[#2A2A2E] text-xs text-slate-300 px-4 py-2.5 rounded-none focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Correcting the startedAt handler typo */}
          <script dangerouslySetInnerHTML={{__html: ""}} />

          {/* Configs parameters: Sliders / numerical panels */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-[#88888F] uppercase tracking-widest flex items-center gap-1.5 border-b border-[#2A2A2E]/50 pb-1.5">
              <Sliders className="w-3.5 h-3.5 text-cosmic-accent" />
              ⚔️ Configuration d'XP de Base & Closing
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="flex flex-col gap-1 bg-slate-950 border border-[#2A2A2E] p-2.5 rounded-none text-center">
                <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider leading-none">Opp XP Defeated</span>
                <input
                  type="number"
                  min={0}
                  value={xpConfig.xpPerDefeatedOpponent}
                  onChange={(e) => updateXpConfigParam("xpPerDefeatedOpponent", Number(e.target.value))}
                  className="bg-transparent text-center font-bold font-mono text-xs text-white focus:outline-none pt-1"
                />
              </div>

              <div className="flex flex-col gap-1 bg-slate-950 border border-[#2A2A2E] p-2.5 rounded-none text-center">
                <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider leading-none">Simple Close</span>
                <input
                  type="number"
                  min={0}
                  value={xpConfig.xpBonusSimple}
                  onChange={(e) => updateXpConfigParam("xpBonusSimple", Number(e.target.value))}
                  className="bg-transparent text-center font-bold font-mono text-xs text-white focus:outline-none pt-1"
                />
              </div>

              <div className="flex flex-col gap-1 bg-slate-950 border border-[#2A2A2E] p-2.5 rounded-none text-center">
                <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider leading-none">Double Close</span>
                <input
                  type="number"
                  min={0}
                  value={xpConfig.xpBonusDouble}
                  onChange={(e) => updateXpConfigParam("xpBonusDouble", Number(e.target.value))}
                  className="bg-transparent text-center font-bold font-mono text-xs text-white focus:outline-none pt-1"
                />
              </div>

              <div className="flex flex-col gap-1 bg-slate-950 border border-[#2A2A2E] p-2.5 rounded-none text-center">
                <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider leading-none">Triple Close</span>
                <input
                  type="number"
                  min={0}
                  value={xpConfig.xpBonusTriple}
                  onChange={(e) => updateXpConfigParam("xpBonusTriple", Number(e.target.value))}
                  className="bg-transparent text-center font-bold font-mono text-xs text-white focus:outline-none pt-1"
                />
              </div>

              <div className="flex flex-col gap-1 bg-slate-950 border border-[#2A2A2E] p-2.5 rounded-none text-center">
                <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider leading-none">Vampire Mlt (x)</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={xpConfig.xpVampireMultiplier}
                  onChange={(e) => updateXpConfigParam("xpVampireMultiplier", Number(e.target.value))}
                  className="bg-transparent text-center font-bold font-mono text-xs text-white focus:outline-none pt-1"
                />
              </div>

              <div className="flex flex-col gap-1 bg-slate-950 border border-[#2A2A2E] p-2.5 rounded-none text-center">
                <span className="text-[9px] font-bold text-slate-550 uppercase tracking-wider leading-none">Survivor Base</span>
                <input
                  type="number"
                  min={0}
                  value={xpConfig.xpSurvivorBase}
                  onChange={(e) => updateXpConfigParam("xpSurvivorBase", Number(e.target.value))}
                  className="bg-transparent text-center font-bold font-mono text-xs text-white focus:outline-none pt-1"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Badges metrics */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-[#88888F] uppercase tracking-widest flex items-center gap-1.5 border-b border-[#2A2A2E]/50 pb-1.5">
              <Sliders className="w-3.5 h-3.5 text-cosmic-accent" />
              🎖️ Configuration d'XP des Badges
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
              {[
                { name: "Poulidor 🥈", key: "xpBonusPoulidor" },
                { name: "Jackpot 🎰", key: "xpBonusJackpot" },
                { name: "Égalité 🤝", key: "xpBonusEgalite" },
                { name: "Géant ⚔️🏆", key: "xpBonusTueurDeGeants" },
                { name: "Phénix 🔥", key: "xpBonusPhenix" },
                { name: "Serial 🔥🔥", key: "xpBonusSerialWinner" },
                { name: "Benjamin 🥉", key: "xpBonusBenjamin" },
                { name: "Tombola 🍀", key: "xpBonusLottery" }
              ].map(badge => {
                return (
                  <div key={badge.key} className="flex flex-col gap-1 bg-slate-950 border border-[#2A2A2E] p-2 rounded-none text-center">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-none truncate">{badge.name}</span>
                    <input
                      type="number"
                      min={0}
                      value={(xpConfig as any)[badge.key]}
                      onChange={(e) => updateXpConfigParam(badge.key as keyof XPConfig, Number(e.target.value))}
                      className="bg-transparent text-center font-bold font-mono text-xs text-white focus:outline-none pt-1 w-full"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Advanced options */}
          <div className="space-y-3 pt-1 border-t border-[#2A2A2E]/40">
            <div className="flex items-center gap-3 bg-slate-950 border border-[#2A2A2E] p-4 rounded-none">
              <input
                type="checkbox"
                id="season-bonus-rang"
                checked={xpConfig.bonusVainqueurParRang}
                onChange={(e) => updateXpConfigParam("bonusVainqueurParRang", e.target.checked)}
                className="w-4 h-4 bg-slate-950 border-slate-805 rounded-none checked:bg-cosmic-accent cursor-pointer text-cosmic-accent"
              />
              <div className="space-y-0.5">
                <label htmlFor="season-bonus-rang" className="text-xs font-bold text-white cursor-pointer select-none">
                  ⚖️ Bonus vainqueur proportionnel au niveau (-25% par palier d'écart avec le perdant)
                </label>
                <p className="text-[10px] text-slate-[#55555F]">
                  Si activé, l'XP obtenue par adversaire battu décroît proportionnellement si le niveau du vainqueur est supérieur.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 justify-end">
            {editingSeasonId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 border border-[#2A2A2E] bg-slate-900 hover:border-slate-700 text-slate-440 hover:text-slate-200 rounded-none cursor-pointer"
              >
                Annuler
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-cosmic-accent to-[#8E1E1E] hover:from-cosmic-accent/90 hover:to-[#8E1E1E]/90 text-white font-extrabold uppercase tracking-widest text-xs rounded-none border border-cosmic-accent/30 cursor-pointer shadow transform hover:-translate-y-0.5 active:translate-y-0 shadow-cosmic-accent/15"
            >
              {editingSeasonId !== null ? "Enregistrer les modifications" : "Lancer la Saison"}
            </button>
          </div>

          {statusMsg && (
            <p className="text-xs font-semibold text-red-400 py-1">{statusMsg}</p>
          )}
        </form>
      </div>

      {/* SEASONS CHRONOLOGICAL TABLE */}
      <div className="bg-[#111114] border border-[#2A2A2E] rounded-none overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950 border-b border-[#2A2A2E]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-display select-none">Saisons Historiques & Actives ({seasons.length})</h3>
        </div>

        <ul className="divide-y divide-[#2A2A2E]/50">
          {seasons.map(s => {
            const hasEnded = s.endedAt ? new Date(s.endedAt) < new Date() : false;
            const startDateStr = new Date(s.startedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
            const endDateStr = s.endedAt ? new Date(s.endedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "Indéfini";

            return (
              <li key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#16161A] transition">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-none flex items-center justify-center border font-display shrink-0 text-sm ${
                    hasEnded
                      ? "bg-slate-950 text-[#55555F] border-slate-900"
                      : "bg-emerald-500/10 border-emerald-500/25 text-emerald-420 font-bold"
                  }`}>
                    {hasEnded ? "🔒" : "🟢"}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm select-text font-serif">{s.name}</h4>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                      Début : {startDateStr} • Fin : {endDateStr}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 ml-11 sm:ml-0">
                  <button
                    onClick={() => handleEditSeason(s)}
                    className="p-1.5 px-3 bg-slate-950 hover:bg-slate-900 hover:text-white border border-[#2A2A2E] text-cosmic-accent text-[10px] font-bold rounded-none cursor-pointer transition flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Éditer
                  </button>
                  <button
                    onClick={() => handleDeleteSeason(s.id, s.name)}
                    className="p-1.5 px-2 bg-red-500/5 hover:bg-red-500/10 text-red-405 hover:text-red-350 border border-red-500/20 rounded-none cursor-pointer transition flex items-center"
                    title="Supprimer la saison"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
