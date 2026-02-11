import React, { useState, useEffect } from 'react';
import { Order, ColorData } from '../../types';
import { Button, Input } from '../UI';
import { generateOrderPDF } from '../../services/pdfService';
import { getGlobalConfig } from '../../services/firebase';

interface OrdersTabProps {
  searchText: string;
  setSearchText: (text: string) => void;
  isLoadingOrders: boolean;
  orders: Order[];
  onEditOrder: (order: Order) => void;
  setOrderToDelete: (order: Order | null) => void;
  loadMoreOrders: () => void;
  hasMoreOrders: boolean;
  isLoadingMore: boolean;
}

const getShirtCount = (order: Order) => {
  const calculate = (data?: ColorData) => {
    if (!data) return 0;
    let q = 0;
    Object.values(data).forEach(cat => {
      Object.values(cat).forEach(val => q += (val as number || 0));
    });
    return q;
  };
  return calculate(order.verdeOliva) + calculate(order.terracota);
};

const formatSetor = (order: Order | null) => {
  if (!order) return '';
  if (order.setor === 'UMADEMATS') return 'UMADEMATS';
  return order.local === 'Capital' && !order.setor.toUpperCase().startsWith('SETOR') 
    ? `SETOR ${order.setor}` 
    : order.setor;
};

export const OrdersTab: React.FC<OrdersTabProps> = ({
  searchText,
  setSearchText,
  isLoadingOrders,
  orders,
  onEditOrder,
  setOrderToDelete,
  loadMoreOrders,
  hasMoreOrders,
  isLoadingMore
}) => {
  const [localFilter, setLocalFilter] = useState<'Todos' | 'Capital' | 'Interior'>('Todos');
  const [loteFilter, setLoteFilter] = useState<number | 'Todos'>('Todos');
  const [expandedSector, setExpandedSector] = useState<string | null>(null);
  const [availableBatches, setAvailableBatches] = useState<number[]>([1]);

  useEffect(() => {
    getGlobalConfig().then(c => {
        const batches = Array.from({length: c.currentBatch}, (_, i) => i + 1);
        setAvailableBatches(batches);
        setLoteFilter(c.currentBatch);
    });
  }, []);

  const filteredOrders = orders.filter(o => {
    const matchesLocal = localFilter === 'Todos' || o.local === localFilter;
    const matchesLote = loteFilter === 'Todos' || (o.lote || 1) === loteFilter;
    const term = searchText.trim().toLowerCase();
    const displaySetor = formatSetor(o).toLowerCase();
    
    const matchesText = !term || (
      o.numPedido.toLowerCase().includes(term) ||
      o.nome.toLowerCase().includes(term) ||
      o.setor.toLowerCase().includes(term) ||
      displaySetor.includes(term) ||
      o.contato.toLowerCase().includes(term)
    );

    return matchesLocal && matchesLote && matchesText;
  });

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 px-2 sm:px-0">
      <div className="flex flex-col gap-6">
        <div className="w-full">
          <Input 
            label="Pesquisar Líder, Código ou Setor" 
            placeholder="Ex: João Silva, PED-A1B2, Dourados..." 
            value={searchText} 
            onChange={e => setSearchText(e.target.value)}
            className="rounded-xl sm:rounded-2xl"
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
              <label className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-primary/70 px-1">Lote de Produção</label>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                  <button 
                      onClick={() => setLoteFilter('Todos')}
                      className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${loteFilter === 'Todos' ? 'bg-primary border-primary text-slate-900 shadow-md' : 'border-border-light text-text-secondary hover:border-primary/30'}`}
                  >
                      Todos
                  </button>
                  {availableBatches.map(b => (
                      <button 
                          key={b} 
                          onClick={() => setLoteFilter(b)}
                          className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${loteFilter === b ? 'bg-primary border-primary text-slate-900 shadow-md' : 'border-border-light text-text-secondary hover:border-primary/30'}`}
                      >
                          Lote {b}
                      </button>
                  ))}
              </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-primary/70 px-1">Filtrar Local</label>
            <div className="flex gap-2 w-full">
              {['Todos', 'Capital', 'Interior'].map(loc => (
                <button 
                  key={loc} 
                  onClick={() => setLocalFilter(loc as any)}
                  className={`flex-1 px-2 sm:px-4 py-2 sm:py-3 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${localFilter === loc ? 'bg-primary border-primary text-slate-900 shadow-md' : 'border-border-light text-text-secondary hover:border-primary/30'}`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {isLoadingOrders ? (
          <LoadingPulse />
        ) : filteredOrders.length === 0 ? (
          <EmptyState />
        ) : (
          filteredOrders.map(order => (
            <OrderListItem 
              key={order.docId} 
              order={order} 
              isExpanded={expandedSector === order.docId}
              onToggle={() => setExpandedSector(expandedSector === order.docId ? null : order.docId)}
              onEdit={() => onEditOrder(order)}
              onPDF={() => generateOrderPDF(order)}
              onDelete={() => setOrderToDelete(order)}
              shirtCount={getShirtCount(order)}
              displaySetor={formatSetor(order)}
            />
          ))
        )}
      </div>

      {hasMoreOrders && !searchText && (
        <div className="mt-8 flex justify-center pb-10">
            <Button onClick={loadMoreOrders} disabled={isLoadingMore} variant="outline" className="h-14 w-full sm:w-auto">
                {isLoadingMore ? "CARREGANDO..." : "CARREGAR MAIS PEDIDOS"}
            </Button>
        </div>
      )}
    </div>
  );
};

const OrderListItem: React.FC<{ 
  order: Order, 
  isExpanded: boolean, 
  onToggle: () => void,
  onEdit: () => void,
  onPDF: () => void,
  onDelete: () => void,
  shirtCount: number,
  displaySetor: string
}> = ({ order, isExpanded, onToggle, onEdit, onPDF, onDelete, shirtCount, displaySetor }) => {
  const whatsappMessage = "Prezado lider, segue em anexo o último relatório de seu pedido de camisetas para o Jubileu da Umademats. Por gentileza, analise o mesmo e nos confirme se está correto para que possamos encaminhar para Produção.";
  const whatsappUrl = `https://wa.me/${order.contato.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className={`card bg-surface overflow-hidden transition-all duration-300 border border-primary/20 rounded-[1.5rem] sm:rounded-[2.5rem] ${isExpanded ? 'ring-2 ring-primary/40 shadow-lg' : 'hover:-translate-y-1 hover:shadow-lg'}`}>
      <div className="p-4 sm:p-6 cursor-pointer relative" onClick={onToggle}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 sm:gap-4 pr-10 sm:pr-14">
          <div className="space-y-2 sm:space-y-3 w-full">
            <div className="flex flex-wrap items-center gap-2">
                <span className="bg-primary/10 text-primary text-[7px] sm:text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest border border-primary/20">Lote {order.lote || 1}</span>
                <h3 className="text-sm sm:text-base font-black text-text-primary tracking-widest uppercase leading-none">#{order.numPedido}</h3>
            </div>
            <p className="text-primary font-black text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] opacity-80">
              {shirtCount} peças • {order.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <div className="space-y-1 sm:space-y-2">
              <p className="text-[10px] sm:text-sm text-text-secondary font-bold uppercase tracking-widest line-clamp-2 leading-tight">
                {order.nome} | {order.local} – {displaySetor}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-sm text-text-secondary/70 font-bold tracking-widest">{order.contato}</span>
                <a 
                  href={whatsappUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-green-500 hover:text-green-400 transition-colors flex items-center justify-center p-2 -m-2 rounded-full"
                >
                  <i className="fab fa-whatsapp text-base sm:text-lg"></i>
                </a>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 absolute right-4 sm:right-6 top-1/2 -translate-y-1/2">
            <div className={`transition-transform duration-500 text-primary/30 ${isExpanded ? 'rotate-180' : ''}`}>
              <i className="fas fa-chevron-down text-base sm:text-lg"></i>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-5 sm:p-8 bg-background border-t border-border-light animate-in slide-in-from-top-4 duration-500">
          <div className="space-y-6 sm:space-y-8">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-1 h-4 sm:w-1.5 sm:h-6 bg-primary rounded-full"></div>
                <p className="text-[9px] sm:text-[11px] font-black text-text-primary uppercase tracking-[0.15em] sm:tracking-[0.2em]">Detalhamento</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <ColorSummary label="Verde Oliva" data={order.verdeOliva} hex="#3b4a3c" />
                <ColorSummary label="Terracota" data={order.terracota} hex="#a35e47" />
              </div>
            </div>
            {order.observacao && (
              <div className="p-3 sm:p-4 rounded-xl bg-surface border border-border-light">
                <p className="text-[8px] sm:text-[9px] font-black text-primary/50 uppercase tracking-widest mb-1 sm:mb-2">Observações</p>
                <p className="text-xs sm:text-sm text-text-secondary italic">"{order.observacao}"</p>
              </div>
            )}
            <div className="flex flex-col gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-border-light">
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit(); }} 
                className="flex items-center justify-center gap-2 px-4 py-3 sm:py-4 rounded-xl sm:rounded-full bg-primary-light text-primary border border-primary/20 text-[9px] sm:text-[10px] font-black uppercase hover:bg-primary hover:text-white transition-all w-full h-12 sm:h-14"
              >
                <i className="fas fa-edit"></i>
                <span>EDITAR PEDIDO</span>
              </button>
              
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                  className="flex items-center justify-center gap-2 px-2 sm:px-4 py-3 sm:py-4 rounded-xl sm:rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-[8px] sm:text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all w-full h-12 sm:h-14"
                >
                  <i className="fas fa-trash-alt"></i>
                  <span className="truncate">Excluir</span>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onPDF(); }} 
                  className="flex items-center justify-center gap-2 px-2 sm:px-4 py-3 sm:py-4 rounded-xl sm:rounded-full bg-slate-900 text-white text-[8px] sm:text-[10px] font-black uppercase hover:brightness-95 transition-all w-full h-12 sm:h-14"
                >
                  <i className="fas fa-file-pdf"></i>
                  <span className="truncate">Baixar PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ColorSummary: React.FC<{ label: string, data?: ColorData, hex: string }> = ({ label, data, hex }) => {
  if (!data) return null;
  const cats = ['infantil', 'babylook', 'unissex'] as const;
  const items: any[] = [];
  cats.forEach(c => {
    Object.entries(data[c] || {}).forEach(([s, q]) => {
      if ((q as number) > 0) items.push({ c, s, q });
    });
  });
  if (items.length === 0) return null;
  return (
    <div className="bg-surface p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-border-light">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shadow-lg" style={{ backgroundColor: hex }}></div>
        <span className="text-[10px] sm:text-[11px] font-black text-text-primary uppercase tracking-[0.15em] sm:tracking-[0.2em]">{label}</span>
      </div>
      <div className="space-y-1.5 sm:space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex justify-between text-[9px] sm:text-[10px] border-b border-border-light/50 pb-1.5 last:border-0 last:pb-0">
            <span className="text-text-secondary font-bold uppercase tracking-widest truncate max-w-[70%]">{it.c} ({it.s})</span>
            <span className="text-text-primary font-black">{it.q}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const LoadingPulse: React.FC = () => (
  <div className="py-16 sm:py-20 text-center animate-pulse">
    <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin mx-auto mb-4 sm:mb-6"></div>
    <p className="text-primary font-black text-[9px] sm:text-[10px] uppercase tracking-[0.3em] opacity-60">Sincronizando...</p>
  </div>
);

const EmptyState: React.FC = () => (
  <div className="py-16 sm:py-20 text-center card border-dashed border-border-light flex flex-col items-center gap-4 sm:gap-6 mx-2 sm:mx-0">
    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-background flex items-center justify-center text-lg sm:text-xl text-text-secondary/40">
      <i className="fas fa-folder-open"></i>
    </div>
    <p className="text-text-secondary font-bold uppercase tracking-[0.3em] text-[9px] sm:text-[10px]">Nenhum registro encontrado</p>
  </div>
);