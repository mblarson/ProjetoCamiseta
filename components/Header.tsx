import React from 'react';
import { Button } from './UI';

interface HeaderProps {
  isAdmin: boolean;
  onAdminClick: () => void;
  // FIX: Add onLogout and isAtAdminPanel props to fix type error in App.tsx and provide contextual admin actions.
  onLogout: () => void;
  isAtAdminPanel: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isAdmin, onAdminClick, onLogout, isAtAdminPanel }) => (
  <header className="fixed top-0 inset-x-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/80 py-4">
    <div className="container mx-auto px-6 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <img 
          src="https://raw.githubusercontent.com/mblarson/sistema-pedidos-camisetas/main/50ANOS8080.png" 
          alt="Logo" 
          className="w-10 h-10 object-contain" 
        />
        <div className="flex flex-col">
          <h1 className="text-md font-extrabold leading-none text-white tracking-tight">UMADEMATS</h1>
          <span className="text-[8px] text-slate-400 font-bold tracking-[0.2em] uppercase mt-1">50 Anos • Mato Grosso do Sul</span>
        </div>
      </div>
      {isAdmin && isAtAdminPanel && (
        <Button variant="danger" className="px-4 py-2 text-[9px] h-10" onClick={onLogout}>
          <i className="fas fa-sign-out-alt"></i> SAIR
        </Button>
      )}
    </div>
  </header>
);