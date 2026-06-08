import { useState, useEffect } from "react";
import { Sparkles, Trophy, Shuffle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Match, Season, Player } from "../types";
import { dbStore } from "../dbStore";

interface SlotMachineLotteryProps {
  match: Match;
  season: Season;
  players: Player[];
  onGainsSaved: (updatedMatch: Match) => void;
}

// Helper to extract emojis
function extractEmojis(str: string): string[] {
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{1F004}\u{1F0CF}]/gu;
  return str.match(emojiRegex) || [];
}

// Generate fallback emojis in various categories to populate reels
function generateAllEmojis(): string[] {
  const common = [
    "🎯", "⭐", "🔥", "🍀", "💎", "👑", "🚀", "🍻", "🍺", "🐉", "🦖", "⚡", "✨", "🎉",
    "👽", "🤖", "🍕", "🍔", "🍎", "🎈", "🎁", "💥", "🧙", "☠️", "⚔️", "🛡️", "🔱", "🏆"
  ];
  return common;
}

export default function SlotMachineLottery({ match, season, players, onGainsSaved }: SlotMachineLotteryProps) {
  const xpBonusLottery = season?.xpBonusLottery ?? 20;

  const [hasSpun, setHasSpun] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<string[]>(["❓", "❓", "❓", "❓", "❓"]);
  const [resultMessage, setResultMessage] = useState("");
  const [resultsList, setResultsList] = useState<string[]>([]);

  // Build the full pool of accessible emojis
  const [emojiPool, setEmojiPool] = useState<string[]>([]);

  useEffect(() => {
    // 1. Gather emojis from participants (up to 5 of each)
    let participantEmojis: string[] = [];
    match.participants.forEach(part => {
      const pData = players.find(x => x.id === part.playerId);
      if (pData) {
        participantEmojis = participantEmojis.concat(extractEmojis(pData.name).slice(0, 5));
      }
    });

    // 2. Gather emojis from other players
    let allPlayerEmojis: string[] = [];
    players.forEach(p => {
      allPlayerEmojis = allPlayerEmojis.concat(extractEmojis(p.name).slice(0, 5));
    });

    const fallback = generateAllEmojis();
    const uniquePool = Array.from(new Set([...participantEmojis, ...allPlayerEmojis, ...fallback]));
    setEmojiPool(uniquePool);
  }, [match, players]);

  const handleSpin = async () => {
    if (spinning || emojiPool.length === 0) return;

    setSpinning(true);
    setHasSpun(true);
    setResultMessage("🎰 Tirage de la tombola en cours...");
    setResultsList([]);

    const drawn: string[] = [];
    const scrollCount = 12; // How many times it cycles before stopping

    // We simulate reel animation in code by changing characters sequentially with a delays
    for (let i = 0; i < scrollCount; i++) {
      await new Promise(resolve => setTimeout(resolve, 80));
      setReels(prev => prev.map(() => emojiPool[Math.floor(Math.random() * emojiPool.length)]));
    }

    // Now, determine final locked reels
    const finalReels = Array.from({ length: 5 }, () => emojiPool[Math.floor(Math.random() * emojiPool.length)]);
    setReels(finalReels);
    setSpinning(false);

    // Calculate outcomes based on the 5 emojis of each player's name
    const playerGains: { playerId: number; xpBonus: number; emojis: string[] }[] = [];
    const matchMessages: string[] = [];

    match.participants.forEach(part => {
      const pData = players.find(x => x.id === part.playerId);
      if (!pData) return;

      const playerEmojis = extractEmojis(pData.name).slice(0, 5);
      const wonEmojis: string[] = [];

      finalReels.forEach(drawnEmoji => {
        if (playerEmojis.includes(drawnEmoji)) {
          wonEmojis.push(drawnEmoji);
        }
      });

      if (wonEmojis.length > 0) {
        const totalBonus = wonEmojis.length * xpBonusLottery;
        playerGains.push({
          playerId: part.playerId,
          xpBonus: totalBonus,
          emojis: wonEmojis
        });
        matchMessages.push(`🎉 ${pData.name} : +${totalBonus} XP ! (Avec ${wonEmojis.join(" ")})`);
      }
    });

    if (playerGains.length > 0) {
      try {
        const updated = await dbStore.updateLotteryGains(match.id, playerGains);
        setResultMessage(`🎰 Tirage Terminé · ${playerGains.length} gagnant(s) !`);
        setResultsList(matchMessages);
        onGainsSaved(updated);
      } catch (err: any) {
        setResultMessage("❌ Erreur pendant l'enregistrement : " + err.message);
      }
    } else {
      setResultMessage("😢 Pas de chance ! Aucun émoji correspondant sur ce tirage.");
    }
  };

  if (xpBonusLottery <= 0) return null;

  return (
    <div className="bg-[#111114] border border-[#2A2A2E] rounded-none p-4 md:p-5 text-center shadow-lg relative overflow-hidden my-4 max-w-md mx-auto">
      {/* Decorative neon borders */}
      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cosmic-accent to-transparent opacity-80" />
      
      <div className="flex items-center justify-center gap-1.5 mb-2 text-cosmic-accent">
        <Sparkles className="w-5 h-5 animate-pulse" />
        <h3 className="font-display font-semibold tracking-wider text-sm uppercase">Tombola Dartos</h3>
        <Sparkles className="w-5 h-5 animate-pulse" />
      </div>

      <p className="text-xs text-slate-300 leading-relaxed mb-4 max-w-xs mx-auto">
        Multipliez vos chances ! Chaque émoji correspondant de votre pseudo gagne <strong className="text-cosmic-accent font-extrabold">{xpBonusLottery} XP</strong> !
      </p>

      {/* SLOT MACHINE SCREEN */}
      <div className="bg-[#0A0A0C] p-4 rounded-none border border-[#2A2A2E] flex justify-center items-center gap-3 shadow-inner md:gap-4 mb-4 select-none">
        {reels.map((emoji, idx) => (
          <div
            key={idx}
            className={`w-12 h-16 md:w-14 md:h-18 rounded-none bg-[#111114] border-2 flex items-center justify-center text-2xl md:text-3xl shadow-md ${
              spinning ? "border-cosmic-accent/80 scale-[1.03] animate-pulse" : "border-[#2A2A2E]"
            }`}
            style={{
              transition: "transform 0.1s, border-color 0.2s"
            }}
          >
            {emoji}
          </div>
        ))}
      </div>

      {/* SPIN BUTTON */}
      <div className="space-y-3">
        <button
          onClick={handleSpin}
          disabled={spinning || hasSpun}
          className={`w-full py-3 px-4 rounded-none font-extrabold uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md select-none transform hover:-translate-y-0.5 active:translate-y-0 transition ${
            spinning || hasSpun
              ? "bg-slate-950 text-slate-600 border border-[#2A2A2E] pointer-events-none"
              : "bg-gradient-to-r from-cosmic-accent to-[#8E1E1E] hover:from-cosmic-accent/90 hover:to-[#8E1E1E]/90 text-white border border-cosmic-accent/30 shadow-cosmic-accent/15"
          }`}
        >
          <Shuffle className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
          {spinning ? "Spinnnn..." : hasSpun ? "Tirage Effectué ✓" : "Lancer la machine !"}
        </button>

        {/* OUTCOME MESSAGE / WINNERS CONTAINER */}
        <AnimatePresence mode="wait">
          {resultMessage && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-1 py-1"
            >
              <p className="text-xs font-bold text-cosmic-accent">{resultMessage}</p>
              {resultsList.length > 0 && (
                <div className="bg-emerald-500/10 rounded-none p-2.5 max-w-sm mx-auto border border-emerald-500/20 space-y-1 text-left">
                  {resultsList.map((msg, i) => (
                    <div key={i} className="text-xs font-semibold text-emerald-305 flex items-center gap-1.5 align-middle select-text">
                      <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
