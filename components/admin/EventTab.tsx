
import React from 'react';

interface EventTabProps {
  config: { pedidosAbertos: boolean; valorCamiseta: number };
  setNewPrice: (price: string) => void;
  setIsPriceModalOpen: (isOpen: boolean) => void;
  formatNumberToCurrency: (value: number) => string;
  setSecurityModal: (modalInfo: { type: 'lock' | 'unlock' | 'end' | 'price' | null; password: string; newValue?: any }) => void;
}

export const EventTab: React.FC<EventTabProps> = ({
  config,
  setNewPrice,
  setIsPriceModalOpen,
  formatNumberToCurrency,
  setSecurityModal,
}) => (
  <div className="space-y-10 animate-in fade-in duration-500">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <EventActionCard 
        icon="fa-money-bill-1-wave" 
        title="Valor Unitário" 
        desc={config.valorCamiseta.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}
        highlightDesc
        onClick={() => {
          setNewPrice(formatNumberToCurrency(config.valorCamiseta));
          setIsPriceModalOpen(true);
        }}
      />

      {config.pedidosAbertos ? (
        <EventActionCard 
          icon="fa-lock" 
          title="Fechar Pedidos" 
          desc=""
          onClick={() => setSecurityModal({ type: 'lock', password: '' })}
        />
      ) : (
        <EventActionCard 
          icon="fa-lock-open" 
          title="Reabrir Pedidos" 
          desc=""
          variant="success"
          onClick={() => setSecurityModal({ type: 'unlock', password: '' })}
        />
      )}

      <EventActionCard 
        icon="fa-circle-exclamation" 
        title="Encerrar Evento" 
        desc=""
        variant="danger"
        onClick={() => setSecurityModal({ type: 'end', password: '' })}
      />
    </div>
    
    <div className="p-6 rounded-3xl bg-background border border-border-light text-center">
      <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">
        Ações executadas nesta aba são irreversíveis e impactam todo o sistema.
      </p>
    </div>
  </div>
);

const EventActionCard: React.FC<{ icon: string, title: string, desc: string, onClick: () => void, variant?: 'danger' | 'success' | 'default', loading?: boolean, highlightDesc?: boolean }> = ({ icon, title, desc, onClick, variant = 'default', loading, highlightDesc }) => (
  <button 
    onClick={onClick}
    disabled={loading}
    className={`card p-8 text-left group relative overflow-hidden flex flex-row items-center gap-6 w-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${variant === 'danger' ? 'hover:border-red-500/50 hover:bg-red-500/5' : variant === 'success' ? 'hover:border-green-500/50 hover:bg-green-500/5' : 'hover:border-primary/50 hover:bg-primary-light'}`}
  >
    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-2xl transition-all duration-500 shrink-0 group-hover:scale-110 group-hover:rotate-3 ${variant === 'danger' ? 'bg-red-500/10 text-red-500' : variant === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-primary-light text-primary'}`}>
      <i className={`fas ${loading ? 'fa-circle-notch fa-spin' : icon}`}></i>
    </div>
    <div className="flex-1">
      <h3 className={`text-xl font-black uppercase tracking-tight ${variant === 'danger' ? 'text-red-500' : variant === 'success' ? 'text-green-500' : 'text-text-primary group-hover:text-primary transition-colors'}`}>{title}</h3>
      {desc && (
        <p className={`font-black uppercase tracking-widest mt-1 leading-relaxed transition-all ${highlightDesc ? 'text-2xl text-primary' : 'text-[11px] text-text-secondary opacity-70 group-hover:opacity-100'}`}>
          {desc}
        </p>
      )}
    </div>
    <div className={`text-xs opacity-0 group-hover:opacity-40 transition-all transform translate-x-4 group-hover:translate-x-0 ${variant === 'danger' ? 'text-red-500' : variant === 'success' ? 'text-green-500' : 'text-primary'}`}>
      <i className="fas fa-chevron-right"></i>
    </div>
  </button>
);
