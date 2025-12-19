
import React, { useState } from 'react';

export const SplashScreen: React.FC<{ onAccess: () => void, loading: boolean }> = ({ onAccess, loading }) => {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    // Pequeno delay para efeito visual antes de desmontar
    setTimeout(onAccess, 150);
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-splash-bg flex items-center justify-center overflow-hidden">
      <div className="relative z-10 flex flex-col items-center gap-8 w-full px-8 mt-auto mb-20 animate-in fade-in slide-in-from-bottom-10 duration-1000">
        <div className="text-left w-full max-w-lg mb-8 px-4 border-l-2 border-white/30 pl-6">
          <h1 className="text-4xl font-black mb-2 tracking-tighter uppercase leading-none text-white">
            Assembleia de Deus<br/>
            <span className="text-white/80">Mato Grosso do Sul</span>
          </h1>
          <p className="text-white/60 text-xs font-bold tracking-[0.15em] uppercase mt-4">
            Jubileu de Ouro • Sistema de Gestão 50 Anos
          </p>
        </div>

        <button 
          onClick={handleClick} 
          disabled={clicked}
          className={`w-full max-w-xs h-16 bg-white text-splash-bg font-black text-xs tracking-[0.25em] rounded-full shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all flex items-center justify-center gap-3 ${clicked ? 'scale-95 opacity-75' : 'active:scale-95 hover:brightness-110'}`}
        >
          {clicked ? (
            <i className="fas fa-circle-notch fa-spin text-lg"></i>
          ) : (
            <>
              INICIAR ACESSO PREMIUM
              <i className="fas fa-chevron-right text-[10px]"></i>
            </>
          )}
        </button>

        {loading && !clicked && (
          <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] animate-pulse">
            Sincronizando com Servidor...
          </p>
        )}
      </div>
    </div>
  );
};