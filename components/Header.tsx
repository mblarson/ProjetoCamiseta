import React from 'react';
import { Button } from './UI';

interface HeaderProps {
  isAdmin: boolean;
  onAdminClick: () => void;
  onLogout: () => void;
  isAtAdminPanel: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isAdmin, onAdminClick, onLogout, isAtAdminPanel }) => (
  <header className="fixed top-0 inset-x-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/80 py-1">
    <div className="container mx-auto px-4 md:px-6 flex justify-between items-center">
      <div className="flex items-center gap-0">
        <div className="relative group">
          <div className="absolute inset-0 bg-white/5 blur-xl rounded-full scale-110 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          
          <img 
            src="https://raw.githubusercontent.com/mblarson/imagens/main/IMG_8660.png" 
            alt="Logo UMADEMATS" 
            className="w-12 h-12 xs:w-14 xs:h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 object-contain relative z-10 contrast-[1.05] brightness-[1.10] transition-transform duration-500 group-hover:scale-105" 
            style={{ 
              imageRendering: 'auto',
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))',
              marginLeft: '-8px'
            }}
          />
        </div>
        <div className="flex flex-col -ml-2 sm:-ml-3">
          <h1 className="text-lg xs:text-xl sm:text-2xl font-black leading-none text-white tracking-tight uppercase">UMADEMATS</h1>
          <span className="text-[7px] xs:text-[8px] sm:text-[10px] text-slate-400 font-bold tracking-[0.1em] sm:tracking-[0.15em] uppercase mt-0.5 sm:mt-1">Igreja Evangélica Assembleia de Deus MS</span>
        </div>
      </div>
    </div>
  </header>
);