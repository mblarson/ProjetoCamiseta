import React from 'react';
import { Stats, Order } from '../../types';
import { Card, Button } from '../UI';

interface DashboardTabProps {
  handleAiAction: () => void;
  isAnalysing: boolean;
  onShowSizeMatrix: () => void;
  aiAnalysis: string;
  currentStats: Stats | null;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  handleAiAction,
  isAnalysing,
  onShowSizeMatrix,
  aiAnalysis,
  currentStats,
}) => (
  <div className="space-y-10 animate-in fade-in duration-700">
    <div className="flex justify-end gap-4">
      <button 
        onClick={handleAiAction} 
        disabled={isAnalysing} 
        className="w-full md:w-auto card px-6 py-4 flex items-center justify-center gap-4 border border-primary/20 hover:bg-primary-light transition-all group"
      >
        <i className="fas fa-sparkles text-primary group-hover:rotate-12 transition-transform"></i>
        <span className="font-black tracking-[0.15em] text-[10px] uppercase">
          {isAnalysing ? "Consultando Gemini..." : "Análise Inteligente"}
        </span>
      </button>
    </div>

    {aiAnalysis && (
      <Card className="border-primary/30 bg-primary-light border-dashed">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <i className="fas fa-robot text-primary text-sm"></i>
          </div>
          <h4 className="font-black text-[10px] uppercase tracking-widest text-primary">Insights da Inteligência Artificial</h4>
        </div>
        <div className="text-sm leading-relaxed text-text-secondary italic whitespace-pre-wrap pl-2">{aiAnalysis}</div>
      </Card>
    )}

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard label="Volume de Pedidos" value={currentStats?.qtd_pedidos || 0} icon="fa-clipboard-list" description="Total de reservas" />
      <StatCard label="Total de Camisetas" value={currentStats?.qtd_camisetas || 0} icon="fa-shirt" description="Soma de todos os tamanhos" />
      <StatCard label="Receita Prevista" value={currentStats?.valor_total || 0} isMoney icon="fa-chart-line" description="Valor total bruto" accentColor="text-primary" />
      <StatCard label="Total Recebido" value={currentStats?.total_recebido_real || 0} isMoney icon="fa-money-bill-trend-up" description="Valores confirmados em caixa" accentColor="text-green-600" bgStyle="bg-green-500/5" />
    </div>

    <div className="pt-6">
      <Button 
        onClick={onShowSizeMatrix} 
        variant="outline"
        className="w-full h-16 text-sm"
      >
          <i className="fas fa-file-alt"></i> Relatório Detalhado de Produção
      </Button>
    </div>
  </div>
);

const StatCard: React.FC<{ label: string, value: number, isMoney?: boolean, icon: string, description: string, accentColor?: string, bgStyle?: string }> = ({ label, value, isMoney, icon, description, accentColor = "text-text-primary", bgStyle = "bg-surface" }) => {
  const hoverStyle = accentColor === 'text-green-600'
    ? 'hover:border-green-500/50 hover:bg-green-500/10'
    : 'hover:border-primary/50 hover:bg-primary-light';
  
  return (
    <Card className={`transition-all duration-500 group relative overflow-hidden ${bgStyle} ${hoverStyle} hover:-translate-y-1`}>
      <div className="absolute -right-4 -top-4 opacity-5 text-7xl transition-transform group-hover:scale-125 group-hover:rotate-6 text-text-primary">
        <i className={`fas ${icon}`}></i>
      </div>
      <div className="flex flex-col h-full justify-center text-center gap-2">
        <div>
          <div className="flex items-center justify-center gap-3 mb-1">
            <div className={`w-2 h-2 rounded-full ${accentColor.replace('text-', 'bg-')}`}></div>
            <p className="text-[10px] text-text-secondary font-black uppercase tracking-[0.2em]">{label}</p>
          </div>
          <p className="text-[8px] text-text-secondary/70 font-bold uppercase tracking-widest">{description}</p>
        </div>
        <p className={`text-4xl font-black tracking-tighter ${accentColor}`}>
          {isMoney ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : value}
        </p>
      </div>
    </Card>
  );
};