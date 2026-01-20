import React, { useState, useEffect } from 'react';
import { Stats } from '../../types';
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
}) => {
  const batchKeys = currentStats?.batches ? Object.keys(currentStats.batches).map(Number).sort((a,b) => a-b) : [1];
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());

  // Comportamento Determinístico: Sempre expande apenas o lote atual ao montar o componente
  useEffect(() => {
    if (batchKeys.length > 0) {
      const activeBatch = batchKeys[batchKeys.length - 1];
      setExpandedBatches(new Set([activeBatch]));
    }
  }, [batchKeys.length]); // Re-executa apenas se a lista de lotes mudar (ex: novo lote criado)

  const toggleBatch = (lote: number) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(lote)) {
        next.delete(lote);
      } else {
        next.add(lote);
      }
      return next;
    });
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex justify-end gap-4">
        <button 
          onClick={handleAiAction} 
          disabled={isAnalysing} 
          className="w-full md:w-auto card px-7 py-5 flex items-center justify-center gap-4 border border-primary/20 hover:bg-primary-light transition-all group"
        >
          <i className="fas fa-sparkles text-primary group-hover:rotate-12 transition-transform text-lg"></i>
          <span className="font-black tracking-[0.15em] text-[12px] uppercase">
            {isAnalysing ? "Consultando Gemini..." : "Análise Inteligente"}
          </span>
        </button>
      </div>

      {aiAnalysis && (
        <Card className="border-primary/30 bg-primary-light border-dashed p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <i className="fas fa-robot text-primary text-base"></i>
            </div>
            <h4 className="font-black text-xs uppercase tracking-widest text-primary">Insights da Inteligência Artificial</h4>
          </div>
          <div className="text-base leading-relaxed text-text-secondary italic whitespace-pre-wrap pl-2">{aiAnalysis}</div>
        </Card>
      )}

      <div className="space-y-4">
         <div className="flex items-center gap-3 mb-2">
            <div className="h-px bg-border-light flex-1"></div>
            <h3 className="text-sm font-black text-text-secondary uppercase tracking-[0.3em]">Totalizadores Globais</h3>
            <div className="h-px bg-border-light flex-1"></div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard 
              label="Receita Global Prevista" 
              value={currentStats?.valor_total || 0} 
              isMoney 
              icon="fa-chart-pie" 
              description="Soma prevista de todos os lotes" 
              accentColor="text-primary" 
              bgStyle="bg-surface border-primary/20"
            />
            <StatCard 
              label="Total Recebido em Caixa" 
              value={currentStats?.total_recebido_real || 0} 
              isMoney 
              icon="fa-money-bill-trend-up" 
              description="Soma de todos os pagamentos efetuados" 
              accentColor="text-green-600" 
              bgStyle="bg-green-500/5 border-green-500/20" 
            />
         </div>
      </div>

      <div className="space-y-8">
        {batchKeys.map(lote => {
           const batchData = currentStats?.batches?.[lote] || (lote === 1 ? currentStats : { qtd_pedidos: 0, qtd_camisetas: 0, valor_total: 0 });
           const isExpanded = expandedBatches.has(lote);
           
           return (
            <div key={lote} className="space-y-4">
               <div 
                 className="flex items-center gap-3 cursor-pointer select-none"
                 onClick={() => toggleBatch(lote)}
               >
                  <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-colors ${isExpanded ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                    LOTE {lote}
                  </span>
                  <div className="h-px bg-border-light flex-1"></div>
                  <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px] text-text-secondary/40`}></i>
               </div>
               
               {isExpanded && (
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-300">
                    <StatCard label="Pedidos no Lote" value={batchData?.qtd_pedidos || 0} icon="fa-clipboard-list" description={`Total do Lote ${lote}`} />
                    <StatCard label="Camisetas no Lote" value={batchData?.qtd_camisetas || 0} icon="fa-shirt" description={`Volume do Lote ${lote}`} />
                    <StatCard label="Receita do Lote" value={batchData?.valor_total || 0} isMoney icon="fa-chart-line" description="Previsão deste lote" accentColor="text-text-primary" />
                 </div>
               )}
            </div>
           );
        })}
      </div>

      <div className="pt-6">
        <Button 
          onClick={onShowSizeMatrix} 
          variant="outline"
          className="w-full h-20 text-base"
        >
            <i className="fas fa-file-alt text-xl"></i> Relatório Detalhado de Produção
        </Button>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: number, isMoney?: boolean, icon: string, description: string, accentColor?: string, bgStyle?: string }> = ({ label, value, isMoney, icon, description, accentColor = "text-text-primary", bgStyle = "bg-surface" }) => {
  const hoverStyle = accentColor === 'text-green-600'
    ? 'hover:border-green-500/50 hover:bg-green-500/10'
    : 'hover:border-primary/50 hover:bg-primary-light';
  
  return (
    <Card className={`transition-all duration-500 group relative overflow-hidden ${bgStyle} ${hoverStyle} hover:-translate-y-1 p-8`}>
      <div className="absolute -right-4 -top-4 opacity-5 text-8xl transition-transform group-hover:scale-125 group-hover:rotate-6 text-text-primary">
        <i className={`fas ${icon}`}></i>
      </div>
      <div className="flex flex-col h-full justify-center text-center gap-3">
        <div>
          <div className="flex items-center justify-center gap-3 mb-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${accentColor.replace('text-', 'bg-')}`}></div>
            <p className="text-xs text-text-secondary font-black uppercase tracking-[0.2em]">{label}</p>
          </div>
          <p className="text-[10px] text-text-secondary/70 font-bold uppercase tracking-widest">{description}</p>
        </div>
        <p className={`text-3xl font-black tracking-tighter ${accentColor}`}>
          {isMoney ? (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : (value || 0)}
        </p>
      </div>
    </Card>
  );
};