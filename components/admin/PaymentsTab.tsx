
import React, { useState, useMemo } from 'react';
import { Order, ColorData } from '../../types';

interface PaymentGroup {
  name: string;
  total: number;
  pago: number;
  restante: number;
  status: 'Pago' | 'Pendente';
  orders: Order[];
}

interface PaymentsTabProps {
  searchText: string;
  setSearchText: (text: string) => void;
  isLoadingOrders: boolean;
  orders: Order[];
  setRegisterPaymentOrder: (order: Order | null) => void;
  setPaymentAmount: (amount: string) => void;
}

export const PaymentsTab: React.FC<PaymentsTabProps> = ({
  searchText,
  setSearchText,
  isLoadingOrders,
  orders,
  setRegisterPaymentOrder,
  setPaymentAmount
}) => {
  const [expandedSector, setExpandedSector] = useState<string | null>(null);

  const groupedPayments = useMemo(() => {
    const groups: Record<string, PaymentGroup> = {};
    orders.forEach(o => {
      let key = o.setor.toUpperCase();
      if (o.local === 'Capital' && !key.startsWith('SETOR')) {
        key = `SETOR ${key}`;
      }
      
      if (!groups[key]) {
        groups[key] = { name: key, total: 0, pago: 0, restante: 0, status: 'Pendente', orders: [] };
      }
      groups[key].total += o.valorTotal;
      groups[key].pago += (o.valorPago || 0);
      groups[key].orders.push(o);
    });

    return Object.values(groups)
      .map(g => {
        g.restante = g.total - g.pago;
        g.status = g.pago >= g.total ? 'Pago' : 'Pendente';
        return g;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="relative max-w-2xl mx-auto">
        <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary/50 text-base"></i>
        <input 
          type="text"
          placeholder="Buscar por Setor, Cidade, Líder ou Código..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-full h-14 md:h-20 bg-surface border border-border-light rounded-2xl pl-12 md:pl-16 pr-6 md:pr-8 text-sm md:text-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-text-secondary/60"
        />
      </div>

      {isLoadingOrders ? (
        <LoadingPulse />
      ) : groupedPayments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groupedPayments.map(group => (
            <div key={group.name} className="flex flex-col gap-4">
              <PaymentGroupCard 
                group={group} 
                isExpanded={expandedSector === group.name}
                onToggle={() => setExpandedSector(expandedSector === group.name ? null : group.name)}
              />
              {expandedSector === group.name && (
                <div className="space-y-3 animate-in slide-in-from-top-4 duration-500 pl-4 border-l-2 border-primary/30">
                  {group.orders.map(order => (
                    <div key={order.docId} className="card bg-surface p-6 flex justify-between items-center hover:border-primary/30 transition-all border border-primary/20">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-black text-primary uppercase tracking-[0.2em] opacity-80">Valor do Pedido</span>
                        <span className="text-xl font-black text-text-primary tracking-tighter">
                          {order.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        <div className="flex items-center gap-2">
                           <span className={`w-2 h-2 rounded-full ${order.statusPagamento === 'Pago' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                           <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{order.statusPagamento}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setRegisterPaymentOrder(order);
                          setPaymentAmount('');
                        }}
                        className="bg-primary-light border border-primary/20 text-primary hover:bg-primary hover:text-white transition-all px-7 py-4 rounded-full text-[11px] font-black uppercase tracking-widest active:scale-95"
                      >
                        GERENCIAR
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PaymentGroupCard: React.FC<{ group: PaymentGroup, isExpanded: boolean, onToggle: () => void }> = ({ group, isExpanded, onToggle }) => (
  <button 
    onClick={onToggle}
    className={`w-full card bg-surface p-7 text-left flex flex-col gap-7 group transition-all duration-300 hover:shadow-xl active:scale-[0.98] border border-primary/20 ${isExpanded ? 'ring-2 ring-primary' : 'hover:border-primary/40 hover:-translate-y-1'}`}
  >
    <div className="flex justify-between items-start">
      <div className="flex items-center gap-4">
        <i className="fas fa-location-dot text-primary text-xl opacity-80 group-hover:scale-110 group-hover:rotate-6 transition-transform"></i>
        <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">{group.name}</h3>
      </div>
      <span className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-[0.15em] border ${group.status === 'Pago' ? 'border-green-500/40 bg-green-500/10 text-green-500' : 'border-red-500/40 bg-red-500/10 text-red-500'}`}>
        {group.status}
      </span>
    </div>

    <div className="grid grid-cols-3 gap-4 border-t border-border-light pt-6">
      <div className="flex flex-col gap-1">
        <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest">Total</p>
        <p className="text-base font-black text-text-primary tracking-tighter whitespace-nowrap">{group.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest">Pago</p>
        <p className={`text-base font-black tracking-tighter whitespace-nowrap ${group.pago > 0 ? 'text-green-600' : 'text-red-500/60'}`}>{group.pago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest">Restante</p>
        <p className={`text-base font-black tracking-tighter whitespace-nowrap ${group.restante > 0 ? 'text-text-primary' : 'text-green-600/70'}`}>{group.restante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
      </div>
    </div>

    <div className="flex justify-center pt-2 mt-auto">
      <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-xs text-text-secondary/60 group-hover:text-primary transition-all duration-300 ${isExpanded ? 'text-primary' : ''}`}></i>
    </div>
  </button>
);

const LoadingPulse: React.FC = () => (
  <div className="py-24 text-center animate-pulse">
    <div className="w-20 h-20 border-4 border-primary/10 border-t-primary rounded-full animate-spin mx-auto mb-8"></div>
    <p className="text-primary font-black text-xs uppercase tracking-[0.3em] opacity-60">Sincronizando Dados...</p>
  </div>
);

const EmptyState: React.FC = () => (
  <div className="py-24 text-center card border-dashed border-border-light flex flex-col items-center gap-8">
    <div className="w-16 h-16 rounded-2xl bg-background flex items-center justify-center text-2xl text-text-secondary/40">
      <i className="fas fa-folder-open"></i>
    </div>
    <p className="text-text-secondary font-bold uppercase tracking-[0.3em] text-xs">Nenhum registro encontrado</p>
  </div>
);
