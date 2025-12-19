
import React, { useState } from 'react';

export const SplashScreen: React.FC<{ onAccess: () => void, loading: boolean }> = ({ onAccess, loading }) => {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    setTimeout(onAccess, 150);
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-splash-bg flex items-center justify-center overflow-hidden">
      {/* Decorative Shapes */}
      <div className="absolute top-[-20%] left-[-15%] w-72 h-72 bg-primary/5 rounded-full filter blur-xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full filter blur-2xl"></div>
      <div className="absolute top-[10%] right-[5%] w-24 h-24 bg-secondary/10 rounded-full filter blur-lg animate-pulse"></div>

      <div className="relative z-10 flex flex-col items-center gap-8 w-full px-8 mt-auto mb-20 animate-in fade-in slide-in-from-bottom-10 duration-1000">
        <div className="text-center w-full max-w-lg mb-8">
          <h1 className="text-6xl font-black mb-4 tracking-tighter leading-none text-text-primary">
            Evolução do Cuidado
          </h1>
          <p className="text-text-secondary text-lg font-light tracking-tight max-w-sm mx-auto">
            Sistema de Gestão para o Jubileu de Ouro da UMADEMATS.
          </p>
        </div>

        <button 
          onClick={handleClick} 
          disabled={clicked}
          className="w-full max-w-sm h-16 bg-transparent border-2 border-primary text-primary font-black text-sm tracking-widest rounded-full transition-all flex items-center justify-center gap-3 uppercase active:scale-95 hover:bg-primary-light"
        >
          {clicked ? (
            <i className="fas fa-circle-notch fa-spin text-2xl"></i>
          ) : (
            <>
              <span>Iniciar</span>
              <i className="fas fa-arrow-right text-xs"></i>
            </>
          )}
        </button>

        {loading && !clicked && (
          <p className="text-[10px] text-text-secondary/70 font-black uppercase tracking-[0.2em] animate-pulse">
            Conectando ao servidor...
          </p>
        )}
      </div>
    </div>
  );
};