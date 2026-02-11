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

  useEffect(() => {
    if (batchKeys.length > 0) {
      const activeBatch = batchKeys[batchKeys.length - 1];
      setExpandedBatches(new Set([activeBatch]));
    }
  }, [batchKeys.length]);

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
    <div className="space-y-6 sm:space-y-10 animate-in fade-in duration-700">
      <div className="flex justify-end gap-3 sm:gap-4 px-2 sm:px-0">
        <button 
          onClick={handleAiAction} 
          disabled={isAnalysing} 
          className="w-full sm:w-auto card px-4 sm:px-7 py-4 sm:py-5 flex items-center justify-center gap-3 sm:gap-4 border border-primary/20 hover:bg-primary-light transition-all group rounded-2xl sm:rounded-3xl"
        >
          <i className="fas fa-sparkles text-primary group-hover:rotate-12 transition-transform text-base sm:text-lg"></i>
          <span className="font-black tracking-[0.1em] sm:tracking-[0.15em] text-[10px] sm:text-[12px] uppercase">
            {isAnalysing ? "Consultando Gemini..." : "Análise Inteligente"}
          </span>
        </button>
      </div>

      {aiAnalysis && (
        <Card className="border-primary/30 bg-primary-light border-dashed p-4 sm:p-8 mx-2 sm:px-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <i className="fas fa-robot text-primary text-sm sm:text-base"></i>
            </div>
            <h4 className="font-black text-[10px] sm:text-xs uppercase tracking-widest text-primary">Insights da IA</h4>
          </div>
          <div className="text-sm sm:text-base leading-relaxed text-text-secondary italic whitespace-pre-wrap pl-1 sm:pl-2">{aiAnalysis}</div>
        </Card>
      )}

      <div className="space-y-4 px-2 sm:px-0">
         <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="h-px bg-border-light flex-1"></div>
            <h3 className="text-[10px] sm:text-sm font-black text-text-secondary uppercase tracking-[0.2em] sm:tracking-[0.3em]">Globais</h3>
            <div className="h-px bg-border-light flex-1"></div>
         </div>
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <StatCard 
              label="Receita Global" 
              value={currentStats?.valor_total || 0} 
              isMoney 
              icon="fa-chart-pie" 
              description="Soma prevista total" 
              accentColor="text-primary" 
              bgStyle="bg-surface border-primary/20"
            />
            <StatCard 
              label="Total em Caixa" 
              value={currentStats?.total_recebido_real || 0} 
              isMoney 
              icon="fa-money-bill-trend-up" 
              description="Pagamentos efetuados" 
              accentColor="text-green-600" 
              bgStyle="bg-green-500/5 border-green-500/20" 
            />
            <StatCard 
              label="Total Peças" 
              value={currentStats?.qtd_camisetas || 0} 
              icon="fa-shirt" 
              description="Volume consolidado" 
              accentColor="text-sky-500" 
              bgStyle="bg-sky-500/5 border-sky-500/20" 
            />
         </div>
      </div>

      <div className="space-y-6 sm:space-y-8 px-2 sm:px-0">
        {batchKeys.map(lote => {
           const batchData = currentStats?.batches?.[lote] || (lote === 1 ? currentStats : { qtd_pedidos: 0, qtd_camisetas: 0, valor_total: 0 });
           const isExpanded = expandedBatches.has(lote);
           
           return (
            <div key={lote} className="space-y-3 sm:space-y-4">
               <div 
                 className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none py-1"
                 onClick={() => toggleBatch(lote)}
               >
                  <span className={`px-2.5 py-1 rounded-md text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-colors ${isExpanded ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                    LOTE {lote}
                  </span>
                  <div className="h-px bg-border-light flex-1"></div>
                  <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-[8px] sm:text-[10px] text-text-secondary/40`}></i>
               </div>
               
               {isExpanded && (
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 animate-in slide-in-from-top-2 duration-300">
                    <StatCard label="Pedidos" value={batchData?.qtd_pedidos || 0} icon="fa-clipboard-list" description={`Lote ${lote}`} />
                    <StatCard label="Volume" value={batchData?.qtd_camisetas || 0} icon="fa-shirt" description={`Lote ${lote}`} />
                    <StatCard label="Receita" value={batchData?.valor_total || 0} isMoney icon="fa-chart-line" description={`Previsão Lote ${lote}`} accentColor="text-text-primary" />
                 </div>
               )}
            </div>
           );
        })}
      </div>

      <div className="pt-4 sm:pt-6 px-2 sm:px-0 pb-10">
        <Button 
          onClick={onShowSizeMatrix} 
          variant="outline"
          className="w-full h-16 sm:h-20 text-sm sm:text-base rounded-2xl sm:rounded-3xl"
        >
            <i className="fas fa-file-alt text-lg sm:text-xl"></i> Matriz de Produção
        </Button>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: number, isMoney?: boolean, icon: string, description: string, accentColor?: string, bgStyle?: string }> = ({ label, value, isMoney, icon, description, accentColor = "text-text-primary", bgStyle = "bg-surface" }) => {
  return (
    <Card className={`transition-all duration-500 group relative overflow-hidden ${bgStyle} hover:border-primary/50 hover:bg-primary-light hover:-translate-y-1 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-3xl`}>
      <div className="absolute -right-3 -top-3 sm:-right-4 sm:-top-4 opacity-5 text-6xl sm:text-8xl transition-transform group-hover:scale-125 group-hover:rotate-6 text-text-primary">
        <i className={`fas ${icon}`}></i>
      </div>
      <div className="flex flex-col h-full justify-center text-center gap-1 sm:gap-3">
        <div>
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-1 sm:mb-1.5">
            <div className={`w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full ${accentColor.replace('text-', 'bg-')}`}></div>
            <p className="text-[10px] sm:text-xs text-text-secondary font-black uppercase tracking-[0.1em] sm:tracking-[0.2em]">{label}</p>
          </div>
          <p className="text-[8px] sm:text-[10px] text-text-secondary/70 font-bold uppercase tracking-widest">{description}</p>
        </div>
        <p className={`text-xl sm:text-3xl font-black tracking-tighter ${accentColor} truncate px-1`}>
          {isMoney ? (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : (value || 0)}
        </p>
      </div>
    </Card>
  );
};