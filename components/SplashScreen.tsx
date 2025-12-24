
import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onAccess: () => void;
  loading: boolean;
}

const LOADING_MESSAGES = [
  "Iniciando motores...",
  "Conectando ao banco de dados...",
  "Sincronizando pedidos em tempo real...",
  "Preparando ambiente Jubileu de Ouro...",
  "Carregando interface premium...",
  "Quase pronto para o evento...",
];

// List of font classes defined in tailwind config in index.html
const FONT_CLASSES = [
  "font-manrope",    // Default
  "font-marker",     // Graffiti/Marker
  "font-playfair",   // Elegant/Italic
  "font-bungee",     // Display Bold
  "font-creepster",  // Drip/Horror Graffiti
  "font-satisfy",    // Script/Handwriting
  "font-spacemono",  // Techy Monospace
  "font-marker italic", // Italicized Marker
];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onAccess, loading }) => {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  // Determine current font index based on progress
  // We want to rotate through fonts every ~12.5% if there are 8 fonts
  const currentFontIndex = Math.floor((progress / 100) * FONT_CLASSES.length);
  const currentFontClass = FONT_CLASSES[Math.min(currentFontIndex, FONT_CLASSES.length - 1)];

  // Efeito para incrementar o progresso
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        // Se ainda estiver conectando ao Firebase, trava em 92% para não passar a sensação de erro
        if (loading && prev >= 92) return prev;
        
        // Incremento aleatório para parecer mais "humano"
        const increment = Math.random() * 8;
        const next = prev + increment;
        
        return next >= 100 ? 100 : next;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [loading]);

  // Efeito para trocar as mensagens
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    return () => clearInterval(messageInterval);
  }, []);

  // Finaliza quando chegar em 100%
  useEffect(() => {
    if (progress >= 100) {
      const timer = setTimeout(onAccess, 500);
      return () => clearTimeout(timer);
    }
  }, [progress, onAccess]);

  return (
    <div className="fixed inset-0 z-[5000] bg-slate-900 flex flex-col items-center justify-center overflow-hidden font-manrope px-8">
      {/* Luz de fundo pulsante */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/10 rounded-full filter blur-[140px] opacity-40 animate-pulse"></div>
      
      <div className="relative z-10 flex flex-col items-center text-center gap-16 w-full max-w-lg">
        {/* Textual Branding Section */}
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-1000">
          <div className="space-y-4">
            {/* Dynamic Font applied here */}
            <h1 className={`${currentFontClass} text-5xl md:text-9xl font-black tracking-tighter leading-none text-white uppercase bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 transition-all duration-300 transform scale-100 hover:scale-105`}>
              UMADEMATS
            </h1>
            <div className="flex items-center justify-center gap-6">
              <div className="h-px w-12 bg-sky-500/30"></div>
              <p className="text-sky-400 font-black uppercase tracking-[0.8em] text-xs md:text-sm">
                2025
              </p>
              <div className="h-px w-12 bg-sky-500/30"></div>
            </div>
          </div>
          <p className="text-slate-400/60 text-[10px] md:text-xs font-bold uppercase tracking-[0.5em]">
            SISTEMA DE GESTÃO DE PEDIDOS
          </p>
        </div>

        {/* Progress Section */}
        <div className="w-full max-w-xs space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
          <div className="relative">
            {/* Background da Barra */}
            <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
              {/* Barra de Progresso com Glow */}
              <div 
                className="h-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-300 ease-out shadow-[0_0_20px_rgba(14,165,233,0.4)]"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            {/* Contador de Porcentagem */}
            <div className="absolute -top-7 right-0">
               <span className="text-xs font-black text-sky-400/80 tabular-nums tracking-widest">
                 {Math.round(progress)}%
               </span>
            </div>
          </div>

          {/* Mensagens de Status */}
          <div className="h-4">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] animate-pulse">
              {LOADING_MESSAGES[messageIndex]}
            </p>
          </div>
        </div>
      </div>

      {/* Footer minimalista do Splash */}
      <div className="absolute bottom-12 left-0 w-full text-center opacity-20">
          <p className="text-[8px] text-white font-bold uppercase tracking-[0.6em]">Premium Infrastructure • Jubileu de Ouro</p>
      </div>
    </div>
  );
};
