import React, { useState, useEffect } from 'react';
import { Card, Input, Button } from './UI';
import { findOrder, findOrderByEmail, getGlobalConfig } from '../services/firebase';
import { generateOrderPDF } from '../services/pdfService';
import { Order, ColorData } from '../types';

interface ConsultSectionProps {
  onEdit?: (order: Order) => void;
  isOrdersOpen: boolean;
}

export const ConsultSection: React.FC<ConsultSectionProps> = ({ onEdit, isOrdersOpen }) => {
  const [id, setId] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundOrders, setFoundOrders] = useState<Order[]>([]);
  const [searched, setSearched] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(1);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    getGlobalConfig().then(c => setCurrentBatch(c.currentBatch));
  }, []);

  const handleSearch = async () => {
    if (!id.trim() && !email.trim()) return;
    setLoading(true);
    setSearched(false);
    setFoundOrders([]);
    
    try {
      let results: Order[] = [];
      if (id.trim()) {
        const res = await findOrder(id);
        if (res) results.push(res);
      }
      if (results.length === 0 && email.trim()) {
        const res = await findOrderByEmail(email);
        results = res;
      }
      setFoundOrders(results);
      if (results.length > 0) {
          setExpandedOrder(results[0].docId); 
      }
      setSearched(true);
    } catch (e) {
      console.error(e);
      alert("Erro ao buscar pedido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const renderTableData = (label: string, colorData?: ColorData) => {
    if (!colorData) return null;
    const items: any[] = [];
    ['infantil', 'babylook', 'unissex'].forEach(cat => {
      const sizes = colorData[cat as keyof ColorData];
      Object.entries(sizes).forEach(([s, q]) => {
        if ((q as number) > 0) items.push({ cat, size: s, qty: q });
      });
    });

    if (items.length === 0) return null;

    return (
      <div className="space-y-3 sm:space-y-4">
        <p className="text-[10px] sm:text-xs font-black uppercase text-primary/70 tracking-widest border-b-2 border-primary/10 pb-2">{label}</p>
        <div className="grid grid-cols-1 gap-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex justify-between text-sm sm:text-base border-b border-border-light pb-2 last:border-0">
              <span className="text-text-secondary uppercase font-bold text-[10px] sm:text-sm">{it.cat} ({it.size})</span>
              <span className="text-text-primary font-black text-xs sm:text-base">{it.qty} un.</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const formatSetor = (order: Order | null) => {
    if (!order) return '';
    if (order.setor === 'UMADEMATS') return 'UMADEMATS';
    return order.local === 'Capital' && !order.setor.toUpperCase().startsWith('SETOR') 
      ? `SETOR ${order.setor}` 
      : order.setor;
  };

  return (
    <div className="max-w-5xl mx-auto animate-in zoom-in-95 duration-500 px-2 sm:px-4">
      <Card className="p-6 sm:p-16 relative overflow-hidden shadow-2xl rounded-[2rem] sm:rounded-[2.5rem]">
        <div className="absolute top-0 right-0 w-32 sm:w-48 h-32 sm:h-48 bg-primary/5 rounded-bl-full -mr-16 sm:-mr-24 -mt-16 sm:-mt-24"></div>
        
        <div className="text-center mb-8 sm:mb-10 relative z-10">
          <h2 className="text-2xl sm:text-6xl font-black mb-2 sm:mb-3 tracking-tighter text-text-primary uppercase">Consultar Pedido</h2>
          <p className="text-text-secondary text-[10px] sm:text-base font-bold uppercase tracking-widest max-w-md mx-auto leading-relaxed opacity-60">
            Localize seu pedido usando o código ou seu e-mail de cadastro.
          </p>
        </div>
        
        <div className="space-y-6 sm:space-y-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
            <Input 
              label="CÓDIGO DO PEDIDO" 
              placeholder="PED-XXXXXX" 
              value={id} 
              onChange={e => setId(e.target.value.toUpperCase())}
              disabled={loading}
              className="text-center font-black tracking-widest uppercase h-12 sm:h-16 text-base sm:text-2xl rounded-xl sm:rounded-[2rem]"
            />
            <Input 
              label="E-MAIL CADASTRADO" 
              placeholder="seu@email.com" 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              className="text-center font-bold h-12 sm:h-16 text-sm sm:text-lg rounded-xl sm:rounded-[2rem]"
            />
          </div>

          <Button 
            className="w-full h-12 sm:h-16 text-sm sm:text-xl rounded-xl sm:rounded-[2rem]" 
            onClick={handleSearch}
            disabled={loading || (!id && !email)}
          >
            {loading ? <i className="fas fa-circle-notch fa-spin text-lg sm:text-2xl"></i> : "LOCALIZAR AGORA"}
          </Button>
          
          {searched && foundOrders.length === 0 && (
            <div className="p-4 sm:p-8 bg-red-500/5 border-2 border-red-500/20 rounded-xl sm:rounded-[2rem] text-red-500 text-[9px] sm:text-sm font-black text-center animate-shake uppercase tracking-widest">
              <i className="fas fa-search-minus mr-2 sm:mr-3"></i> Nenhum pedido encontrado.
            </div>
          )}

          <div className="space-y-4 sm:space-y-6 pt-2 sm:pt-6">
            {foundOrders.map(order => {
                const isCurrentBatch = (order.lote || 1) === currentBatch;
                const isOpen = expandedOrder === order.docId;

                return (
                    <div key={order.docId} className="animate-in fade-in slide-in-from-top-6 duration-600">
                    <div className="bg-white rounded-[1.5rem] sm:rounded-[3rem] border-2 border-primary/20 shadow-xl overflow-hidden">
                        
                        <div 
                            className={`p-5 sm:p-8 cursor-pointer flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4 transition-colors ${isOpen ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                            onClick={() => setExpandedOrder(isOpen ? null : order.docId)}
                        >
                             <div className="flex flex-col md:flex-row items-center gap-3 sm:gap-4">
                                <div className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-black uppercase tracking-widest text-[8px] sm:text-[10px] border ${isCurrentBatch ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                    LOTE {order.lote || 1}
                                </div>
                                <div className="text-center md:text-left">
                                    <p className="text-[8px] sm:text-[10px] text-text-secondary font-bold uppercase tracking-widest">Pedido</p>
                                    <p className="text-lg sm:text-2xl font-black text-text-primary tracking-widest">{order.numPedido}</p>
                                </div>
                             </div>
                             <i className={`fas fa-chevron-down text-primary transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
                        </div>

                        {isOpen && (
                            <div className="p-5 sm:p-10 border-t border-border-light space-y-6 sm:space-y-10">
                                <div className="flex flex-col md:flex-row justify-between gap-4 sm:gap-8">
                                <div className="space-y-0.5 sm:space-y-1.5 text-center sm:text-left">
                                    <p className="text-[8px] sm:text-[10px] font-black text-text-secondary uppercase tracking-[0.2em]">Responsável</p>
                                    <p className="text-text-primary font-black text-base sm:text-2xl uppercase tracking-tight break-words">{order.nome}</p>
                                </div>
                                <div className="space-y-0.5 sm:space-y-1.5 text-center md:text-right">
                                    <p className="text-[8px] sm:text-[10px] font-black text-text-secondary uppercase tracking-[0.2em]">Pagamento</p>
                                    <span className={`inline-flex px-3 py-1 sm:px-5 sm:py-2 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest border-2 ${order.statusPagamento === 'Pago' ? 'border-green-500 text-green-600 bg-green-50' : 'border-red-500 text-red-600 bg-red-50'}`}>
                                        {order.statusPagamento}
                                    </span>
                                </div>
                                </div>

                                <div className="pt-4 sm:pt-8 border-t border-border-light text-center sm:text-left">
                                    <p className="text-[8px] sm:text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-1">Localização</p>
                                    <p className="text-primary font-black text-base sm:text-2xl uppercase tracking-tight">{order.local} • {formatSetor(order)}</p>
                                </div>

                                <div className="pt-4 sm:pt-8 border-t border-border-light">
                                <p className="text-[9px] sm:text-sm font-black text-text-primary uppercase tracking-[0.3em] mb-4 sm:mb-8 flex items-center justify-center sm:justify-start gap-2 sm:gap-3">
                                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-primary rounded-full shadow-lg shadow-primary/30"></div>
                                    Detalhamento
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-12">
                                    {renderTableData("Verde Oliva", order.verdeOliva)}
                                    {renderTableData("Terracota", order.terracota)}
                                </div>
                                </div>

                                {order.observacao && (
                                <div className="pt-4 sm:pt-10 border-t border-border-light text-center sm:text-left">
                                    <p className="text-[8px] sm:text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2 sm:mb-3">Observações</p>
                                    <div className="p-4 sm:p-5 bg-surface rounded-xl sm:rounded-[2rem] border border-border-light italic text-text-primary text-xs sm:text-sm">
                                    "{order.observacao}"
                                    </div>
                                </div>
                                )}

                                <div className="pt-4 sm:pt-10 border-t border-border-light flex flex-col gap-4 sm:gap-6">
                                    {!isCurrentBatch && (
                                        <div className="p-3 sm:p-5 bg-gray-100 border-2 border-gray-200 rounded-xl sm:rounded-[2rem] text-center">
                                            <p className="text-[8px] sm:text-sm font-black text-gray-500 uppercase tracking-widest">
                                                <i className="fas fa-history mr-2"></i> Lote Anterior (Apenas Leitura)
                                            </p>
                                        </div>
                                    )}
                                    
                                    {!isOrdersOpen && isCurrentBatch && (
                                        <div className="p-3 sm:p-5 bg-yellow-500/5 border-2 border-yellow-500/20 rounded-xl sm:rounded-[2rem] text-center">
                                            <p className="text-[8px] sm:text-sm font-black text-yellow-700 uppercase tracking-widest">
                                            <i className="fas fa-lock mr-2"></i> Prazo de alterações encerrado.
                                            </p>
                                        </div>
                                    )}
                                <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                                    <Button 
                                        variant="outline" 
                                        className={`flex-1 h-12 sm:h-16 text-[9px] sm:text-xs rounded-xl sm:rounded-[2rem] ${(!isOrdersOpen || !isCurrentBatch) ? 'opacity-30 cursor-not-allowed' : ''}`} 
                                        onClick={() => (isOrdersOpen && isCurrentBatch) && onEdit?.(order)}
                                        disabled={!isOrdersOpen || !isCurrentBatch}
                                    >
                                    <i className="fas fa-edit"></i> EDITAR PEDIDO
                                    </Button>
                                    <Button 
                                        variant="primary" 
                                        className="flex-1 h-12 sm:h-16 text-[9px] sm:text-xs rounded-xl sm:rounded-[2rem]" 
                                        onClick={() => generateOrderPDF(order)}
                                    >
                                    <i className="fas fa-file-pdf"></i> OBTER PDF
                                    </Button>
                                </div>
                                </div>
                            </div>
                        )}
                    </div>
                    </div>
                );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
};