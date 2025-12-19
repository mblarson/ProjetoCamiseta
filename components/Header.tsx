
import React from 'react';
import { Button } from './UI';

interface HeaderProps {
  isAdmin: boolean;
  onAdminClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isAdmin, onAdminClick }) => (
  <header className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border-light py-4">
    <div className="container mx-auto px-6 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <img 
          src="https://raw.githubusercontent.com/mblarson/sistema-pedidos-camisetas/main/50ANOS8080.png" 
          alt="Logo" 
          className="w-10 h-10 object-contain" 
        />
        <div className="flex flex-col">
          <h1 className="text-md font-extrabold leading-none text-primary tracking-tight">UMADEMATS</h1>
          <span className="text-[8px] text-primary/80 font-bold tracking-[0.2em] uppercase mt-1">50 Anos • Mato Grosso do Sul</span>
        </div>
      </div>
      {isAdmin && (
        <Button variant="outline" className="px-4 py-2 text-[9px]" onClick={onAdminClick}>
          <i className="fas fa-user-shield"></i> PAINEL ADM
        </Button>
      )}
    </div>
  </header>
);