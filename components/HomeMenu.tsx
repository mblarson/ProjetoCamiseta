import React from 'react';
import { Section } from '../types';
import { Button as MovingBorderButton } from './ui/moving-border';

export const HomeMenu: React.FC<{ onNavigate: (s: Section) => void, isOrdersOpen: boolean }> = ({ onNavigate, isOrdersOpen }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-10 md:gap-16 animate-in fade-in zoom-in-95 duration-1000 pt-8 md:pt-24">
      <div className="text-center space-y-6 md:space-y-8 w-full max-w-[1400px]">
        {/* Tamanho de fonte reduzido no mobile e mantido no desktop */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tighter leading-tight text-text-primary whitespace-nowrap overflow-visible">
          Gestão de <span className="text-primary">Pedidos</span>
        </h1>
        
        <p className="text-sm md:text-xl text-text-secondary font-bold max-w-3xl mx-auto leading-relaxed px-4">
          Registre aqui os pedidos de camisetas para o Jubileu da Umademats 2026. <span className="text-primary font-black uppercase tracking-wider">AQUI JESUS REINA!</span>
        </p>
        
        <div className="flex flex-col items-center gap-4">
          {!isOrdersOpen && (
            <div className="flex items-center gap-2 px-5 py-2 rounded-full border border-red-200 bg-white text-red-500 shadow-sm animate-in fade-in slide-in-from-top-2 duration-700">
              <i className="fas fa-lock text-[10px]"></i>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Prazo de novos pedidos encerrado</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid de botões com espaçamento ajustado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 w-full max-w-[1400px] px-4">
        {isOrdersOpen ? (
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
          title="Consultar Pedido" 
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
  <MovingBorderButton
    onClick={onClick}
    borderRadius="1.25rem"
    duration={4000}
    containerClassName="w-full h-24 md:h-32 group transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
    borderClassName="bg-[radial-gradient(var(--primary)_40%,transparent_60%)]"
    className="bg-slate-50 p-5 md:p-8 text-left justify-start gap-5 md:gap-6 border-transparent backdrop-blur-none"
  >
    {/* Ícone levemente maior no mobile para equilibrar com o novo card */}
    <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-3xl transition-all group-hover:scale-110 shrink-0 bg-primary-light text-primary border border-primary/10">
      <i className={`fas ${icon}`}></i>
    </div>
    <div className="flex-1 overflow-hidden">
      {/* Fonte ajustada para desktop e remoção de nowrap para evitar corte de texto */}
      <h3 className="text-base md:text-base lg:text-lg font-black tracking-tight text-text-primary uppercase leading-snug">
        {title}
      </h3>
    </div>
    <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 text-primary transform translate-x-[-10px] group-hover:translate-x-0 hidden sm:block">
      <i className="fas fa-arrow-right text-base md:text-xl"></i>
    </div>
  </MovingBorderButton>
);