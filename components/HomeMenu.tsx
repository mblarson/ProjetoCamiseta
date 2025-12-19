
import React, { useState, useEffect } from 'react';
import { Section } from '../types';
import { getGlobalConfig } from '../services/firebase';

export const HomeMenu: React.FC<{ onNavigate: (s: Section) => void }> = ({ onNavigate }) => {
  const [pedidosAbertos, setPedidosAbertos] = useState(true);

  useEffect(() => {
    getGlobalConfig().then(c => setPedidosAbertos(c.pedidosAbertos));
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] gap-16 animate-in fade-in zoom-in-95 duration-1000">
      <div className="text-center space-y-6">
        <div className="inline-block px-4 py-1 rounded-full border border-primary/20 bg-primary/5 mb-2">
          <p className="text-primary font-black uppercase tracking-[0.4em] text-[8px]">Mato Grosso do Sul • 2025</p>
        </div>
        <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.85] text-text-primary">
          Gestão de<br/><span className="text-primary">Pedidos</span>
        </h1>
        <p className="text-text-secondary/50 font-medium uppercase tracking-[0.5em] text-[9px]">Jubileu de Ouro • UMADEMATS</p>
      </div>
      
      {!pedidosAbertos && (
        <div className="w-full max-w-lg p-6 card bg-red-500/5 border-red-500/20 text-center">
          <p className="text-red-500 font-black text-xs uppercase tracking-[0.3em] animate-pulse">
            <i className="fas fa-lock mr-2"></i> Pedidos Temporariamente Encerrados
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl px-4">
        {pedidosAbertos ? (
          <HomeCard 
            icon="fa-cart-plus" 
            title="Novo Pedido" 
            onClick={() => onNavigate(Section.Order)} 
          />
        ) : (
          <div className="opacity-40 grayscale cursor-not-allowed">
            <HomeCard 
              icon="fa-lock" 
              title="Pedidos Fechados" 
              onClick={() => {}} 
            />
          </div>
        )}
        <HomeCard 
          icon="fa-magnifying-glass" 
          title="Consulta" 
          onClick={() => onNavigate(Section.Consult)} 
        />
        <HomeCard 
          icon="fa-shield-halved" 
          title="Administração" 
          onClick={() => onNavigate(Section.Admin)} 
        />
      </div>
    </div>
  );
};

const HomeCard: React.FC<{ icon: string, title: string, onClick: () => void }> = ({ icon, title, onClick }) => (
  <button 
    onClick={onClick} 
    className="group card p-7 text-left transition-all duration-300 hover:-translate-y-2 hover:shadow-xl flex items-center gap-6 w-full"
  >
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all group-hover:scale-110 shrink-0 bg-primary-light text-primary border border-primary/10">
      <i className={`fas ${icon}`}></i>
    </div>
    <div className="flex-1">
      <h3 className="text-base md:text-lg font-black tracking-[0.15em] text-text-primary uppercase leading-none">
        {title}
      </h3>
    </div>
    <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 text-primary transform translate-x-[-10px] group-hover:translate-x-0">
      <i className="fas fa-arrow-right text-xs"></i>
    </div>
  </button>
);