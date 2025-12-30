
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

const FONT_CLASSES = [
  "font-manrope",
  "font-marker",
  "font-playfair",
  "font-bungee",
  "font-creepster",
  "font-satisfy",
  "font-spacemono",
  "font-marker italic",
];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onAccess, loading }) => {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  const currentFontIndex = Math.floor((progress / 100) * FONT_CLASSES.length);
  const currentFontClass = FONT_CLASSES[Math.min(currentFontIndex, FONT_CLASSES.length - 1)];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (loading && prev >= 92) return prev;
        const increment = Math.random() * 8;
        const next = prev + increment;
        return next >= 100 ? 100 : next;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    return () => clearInterval(messageInterval);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      const timer = setTimeout(onAccess, 500);
      return () => clearTimeout(timer);
    }
  }, [progress, onAccess]);

  return (
    <div className="fixed inset-0 z-[5000] bg-slate-900 flex flex-col items-center justify-center overflow-hidden font-manrope px-8 text-white">
      {/* PERFORMANCE OPTIMIZATION: Removed heavy blur background effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-sky-500/5 rounded-full opacity-20"></div>
      
      <div className="relative z-10 flex flex-col items-center text-center gap-16 w-full max-w-lg">
        <div className="space-y-6">
          <div className="space-y-4">
            <h1 className={`${currentFontClass} text-5xl md:text-9xl font-black tracking-tighter leading-none uppercase transition-all duration-300 transform`}>
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

        <div className="w-full max-w-xs space-y-8">
          <div className="relative">
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-sky-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            <div className="absolute -top-7 right-0">
               <span className="text-xs font-black text-sky-400/80 tabular-nums tracking-widest">
                 {Math.round(progress)}%
               </span>
            </div>
          </div>

          <div className="h-4">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em]">
              {LOADING_MESSAGES[messageIndex]}
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 left-0 w-full text-center opacity-20">
          <p className="text-[8px] text-white font-bold uppercase tracking-[0.6em]">Premium Infrastructure • Jubileu de Ouro</p>
      </div>
    </div>
  );
};
