import { useState, useEffect } from "react";
import { Info, X, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const SPLASH_VERSION = "2.02";
const STORAGE_KEY = "dartos_splash_seen_v2";

interface SplashModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function SplashModal({ forceOpen = false, onClose }: SplashModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== SPLASH_VERSION || forceOpen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, SPLASH_VERSION);
    setIsOpen(false);
    if (onClose) onClose();
  };

  const steps = [
    {
      emoji: "🎯",
      title: "Bienvenue dans Dartos",
      sub: "L'arène des fléchettes tactiques",
      content: (
        <div className="space-y-4">
          <div className="flex gap-4 justify-center py-2">
            <div className="bg-slate-950/80 border border-[#2A2A2E] p-4 rounded-none text-center w-28 shadow-lg shadow-black/30">
              <span className="block text-2xl font-bold text-cosmic-accent font-display">301</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Score de Départ</span>
            </div>
            <div className="bg-cosmic-accent/15 border border-cosmic-accent/30 p-4 rounded-none text-center w-40 shadow-lg shadow-cosmic-accent/5">
              <span className="block text-2xl">💀</span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-cosmic-accent">Mort Subite</span>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed text-center">
            Descendez à zéro exactement pour remporter la victoire. Les survivants gardent leur score restant comme cicatrice de défaite.
          </p>
        </div>
      )
    },
    {
      emoji: "⚔️",
      title: "Progression & Titres RPG",
      sub: "Un système d'expérience immersif",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-slate-300 text-center leading-relaxed font-sans">
            Chaque fléchette lancée compte ! Accumulez de l'XP à chaque match pour progresser :
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs max-w-sm mx-auto">
            <div className="bg-[#111114] p-2 border border-[#2A2A2E] flex justify-between items-center rounded-none">
              <span className="text-slate-400 font-medium">Pousse-Caillou</span>
              <span className="font-mono text-emerald-400 font-black text-sm">0+ XP</span>
            </div>
            <div className="bg-[#111114] p-2 border border-[#2A2A2E] flex justify-between items-center rounded-none">
              <span className="text-slate-400 font-medium">Lanceur de Dimanche</span>
              <span className="font-mono text-emerald-400 font-black text-sm">500+ XP</span>
            </div>
            <div className="bg-[#111114] p-2 border border-[#2A2A2E] flex justify-between items-center grid-col-span-2 col-span-2 rounded-none">
              <span className="text-slate-400 font-medium font-bold">Sniper de Comptoir</span>
              <span className="font-mono text-emerald-400 font-black text-sm">2 000+ XP</span>
            </div>
            <div className="bg-[#111114] p-2 border border-[#2A2A2E] flex justify-between items-center rounded-none">
              <span className="text-slate-400 font-medium">Maître du 301</span>
              <span className="font-mono text-emerald-400 font-black text-sm">5 000+ XP</span>
            </div>
            <div className="bg-amber-500/10 p-2 rounded-none border border-amber-500/20 flex justify-between items-center text-amber-300 font-semibold col-span-2">
              <span>👑 Phil Taylor</span>
              <span className="font-mono text-emerald-400 font-black text-sm">10k+ XP</span>
            </div>
          </div>
        </div>
      )
    },
    {
      emoji: "🛡️",
      title: "Guildes & Rangs Dynamiques",
      sub: "Rejoignez une alliance de choc",
      content: (
        <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
          <ul className="space-y-2 max-w-md mx-auto text-left text-xs bg-slate-950/60 p-3 rounded-none border border-[#2A2A2E]">
            <li className="flex items-start gap-2">
              <span className="text-amber-400">🏷️</span>
              <span><strong>Alliance Personnalisée</strong> : Fondez une guilde sous vos propres couleurs avec votre badge emoji.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">👑</span>
              <span><strong>Hiérarchie Autonome</strong> : Grades calculés en temps réel de Recrue 👤 à Divinité du Triple 👑✨.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cosmic-accent">🏆</span>
              <span><strong>Hauts Faits Collectifs</strong> : Débloquez des médailles collectives (Légendes Vivantes, Tanière des Géants).</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      emoji: "🎰",
      title: "La Tombola des Émojis",
      sub: "Le jackpot de fin de partie 🍀",
      content: (
        <div className="space-y-3 prose prose-invert max-w-sm mx-auto text-xs text-slate-300">
          <p className="text-center leading-relaxed">
            Misez sur la chance post-match ! Les 5 premiers émojis inclus dans votre pseudo servent de tickets :
          </p>
          <div className="bg-[#111114] p-3 rounded-none border border-[#2A2A2E] flex flex-col gap-2 shadow-inner">
            <div className="flex justify-between items-center border-b border-slate-800/40 pb-1.5">
              <span className="text-emerald-400 font-semibold font-mono tracking-wider">🎰 Tirage :</span>
              <span className="font-mono text-slate-400">5 rouleaux d'émojis</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-800/40 pb-1.5">
              <span className="text-cosmic-accent font-semibold font-mono tracking-wider">💎 Récompense :</span>
              <span className="text-white"><strong className="text-emerald-400 font-black text-sm">+20 XP</strong> par émoji identique tiré !</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-purple-400 font-semibold font-mono tracking-wider">🏅 Badge Super Jackpot :</span>
              <span className="text-white">Médailles de tombola exclusives (ex: 🍀🎉)</span>
            </div>
          </div>
        </div>
      )
    },
    {
      emoji: "🏆",
      title: "Rejoignez la Légende !",
      sub: "Votre voyage commence maintenant",
      content: (
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-300 leading-relaxed py-2 max-w-sm mx-auto font-sans">
            Rejoignez une guilde ou fondez la vôtre, enregistrez vos matchs, collectionnez des badges et grimpez au sommet du classement !
          </p>
          <div className="flex justify-center pt-2">
            <button
              onClick={handleClose}
              id="splash-cta"
              className="px-6 py-3 bg-gradient-to-r from-cosmic-accent to-[#8E1E1E] hover:from-cosmic-accent/85 hover:to-[#8E1E1E]/85 text-white font-extrabold text-xs uppercase tracking-widest rounded-none border border-cosmic-accent/30 flex items-center gap-2 shadow-lg shadow-cosmic-accent/20 transform hover:-translate-y-0.5 active:translate-y-0 transition cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current text-white" />
              C'est parti ! 🎯
            </button>
          </div>
        </div>
      )
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-lg bg-slate-900 border border-slate-800/85 rounded-3xl overflow-hidden shadow-2xl flex flex-col box-glow"
          >
            {/* Header / Dismiss */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Slide Area */}
            <div className="p-6 md:p-8 flex-1 flex flex-col justify-center min-h-[380px]">
              <div className="text-center space-y-4">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 100 }}
                  className="text-6xl md:text-7xl select-none"
                >
                  {steps[currentStep].emoji}
                </motion.div>

                <div className="space-y-1">
                  <h2 className="text-xl md:text-2xl font-bold font-display text-white tracking-tight">
                    {steps[currentStep].title}
                  </h2>
                  <p className="text-xs md:text-sm text-sky-400/90 font-medium">
                    {steps[currentStep].sub}
                  </p>
                </div>

                <div className="py-4">
                  {steps[currentStep].content}
                </div>
              </div>
            </div>

            {/* Navigation Bar */}
            <div className="p-6 bg-slate-950/80 border-t border-slate-800/50 flex items-center justify-between">
              <button
                onClick={() => currentStep > 0 && setCurrentStep(currentStep - 1)}
                disabled={currentStep === 0}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                aria-label="Précédent"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              {/* Step Dots */}
              <div className="flex gap-2">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentStep(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                      i === currentStep ? "bg-sky-400 w-6" : "bg-slate-700 hover:bg-slate-500"
                    }`}
                    aria-label={`Aller au slide ${i + 1}`}
                  />
                ))}
              </div>

              {currentStep < steps.length - 1 ? (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition cursor-pointer"
                  aria-label="Suivant"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              ) : (
                <div className="w-10 h-10" /> // Spacer
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
