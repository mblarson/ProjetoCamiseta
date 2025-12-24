
import React, { useState } from 'react';
import { Card, Input, Button } from './UI';
import { findOrder, findOrderByEmail } from '../services/firebase';
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
  const [order, setOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!id.trim() && !email.trim()) return;
    setLoading(true);
    setSearched(false);
    setOrder(null);
    
    try {
      let res: Order | null = null;
      if (id.trim()) {
        res = await findOrder(id);
      }
      if (!res && email.trim()) {
        res = await findOrderByEmail(email);
      }
      setOrder(res);
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
      <div className="space-y-4">
        <p className="text-xs font-black uppercase text-primary/70 tracking-widest border-b-2 border-primary/10 pb-2">{label}</p>
        <div className="grid grid-cols-1 gap-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex justify-between text-base border-b border-border-light pb-2">
              <span className="text-text-secondary uppercase font-bold">{it.cat} ({it.size})</span>
              <span className="text-text-primary font-black">{it.qty} un.</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const formatSetor = (order: Order | null) => {
    if (!order) return '';
    return order.local === 'Capital' && !order.setor.toUpperCase().startsWith('SETOR') 
      ? `SETOR ${order.setor}` 
      : order.setor;
  };

  return (
    <div className="max-w-5xl mx-auto animate-in zoom-in-95 duration-500">
      <Card className="p-6 md:p-16 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-bl-full -mr-24 -mt-24"></div>
        
        <div className="text-center mb-10 relative z-10">
          <h2 className="text-2xl md:text-6xl font-black mb-3 tracking-tighter text-text-primary uppercase">Consultar Pedido</h2>
          <p className="text-text-secondary text-[11px] md:text-base font-bold uppercase tracking-widest max-w-md mx-auto leading-relaxed opacity-60">
            Localize seu pedido usando o código ou seu e-mail de cadastro.
          </p>
        </div>
        
        <div className="space-y-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <Input 
              label="CÓDIGO DO PEDIDO" 
              placeholder="PED-XXXXXX" 
              value={id} 
              onChange={e => setId(e.target.value.toUpperCase())}
              disabled={loading}
              className="text-center font-black tracking-widest uppercase h-12 md:h-16 text-base md:text-2xl rounded-2xl"
            />
            <Input 
              label="E-MAIL CADASTRADO" 
              placeholder="seu@email.com" 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              className="text-center font-bold h-12 md:h-16 text-sm md:text-lg rounded-2xl"
            />
          </div>

          <Button 
            className="w-full h-12 md:h-16 text-sm md:text-xl" 
            onClick={handleSearch}
            disabled={loading || (!id && !email)}
          >
            {loading ? <i className="fas fa-circle-notch fa-spin text-xl md:text-2xl"></i> : "LOCALIZAR PEDIDO AGORA"}
          </Button>
          
          {searched && !order && (
            <div className="p-6 md:p-8 bg-red-500/5 border-2 border-red-500/20 rounded-3xl text-red-500 text-[10px] md:text-sm font-black text-center animate-shake uppercase tracking-widest">
              <i className="fas fa-search-minus mr-3"></i> Nenhum pedido encontrado.
            </div>
          )}

          {order && (
            <div className="animate-in fade-in slide-in-from-top-6 duration-600 pt-4 md:pt-6">
              <div className="p-6 md:p-10 bg-white rounded-[1.5rem] md:rounded-[2.5rem] border-2 border-primary/20 space-y-8 md:space-y-10 shadow-xl">
                
                <div className="flex flex-col md:flex-row justify-between gap-6 md:gap-8">
                  <div className="space-y-1 md:space-y-1.5">
                      <p className="text-[10px] md:text-xs font-black text-text-secondary uppercase tracking-[0.2em]">Número Identificador</p>
                      <p className="text-text-primary font-black text-2xl md:text-4xl tracking-widest">{order.numPedido}</p>
                  </div>
                  <div className="space-y-1 md:space-y-1.5 text-left md:text-right">
                      <p className="text-[10px] md:text-xs font-black text-text-secondary uppercase tracking-[0.2em]">Status de Pagamento</p>
                      <span className={`inline-flex px-4 py-1.5 md:px-5 md:py-2 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest border-2 ${order.statusPagamento === 'Pago' ? 'border-green-500 text-green-600 bg-green-50' : 'border-red-500 text-red-600 bg-red-50'}`}>
                        {order.statusPagamento}
                      </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 pt-6 border-t border-border-light">
                  <div className="space-y-1 md:space-y-1.5">
                      <p className="text-[10px] md:text-xs font-black text-text-secondary uppercase tracking-[0.2em]">Responsável</p>
                      <p className="text-text-primary font-black text-lg md:text-2xl uppercase tracking-tight">{order.nome}</p>
                  </div>
                  <div className="space-y-1 md:space-y-1.5">
                      <p className="text-[10px] md:text-xs font-black text-text-secondary uppercase tracking-[0.2em]">Origem / Destino</p>
                      <p className="text-primary font-black text-lg md:text-2xl uppercase tracking-tight">{order.local} • {formatSetor(order)}</p>
                  </div>
                </div>

                <div className="pt-6 md:pt-8 border-t border-border-light">
                   <p className="text-xs md:text-sm font-black text-text-primary uppercase tracking-[0.3em] mb-6 md:mb-8 flex items-center gap-3">
                     <div className="w-2.5 h-2.5 bg-primary rounded-full shadow-lg shadow-primary/30"></div>
                     Detalhamento das Camisetas
                   </p>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-12">
                      {renderTableData("Opção: Verde Oliva", order.verdeOliva)}
                      {renderTableData("Opção: Terracota", order.terracota)}
                   </div>
                </div>

                <div className="pt-8 md:pt-10 border-t border-border-light flex flex-col gap-5 md:gap-6">
                   {!isOrdersOpen && (
                     <div className="p-4 md:p-5 bg-yellow-500/5 border-2 border-yellow-500/20 rounded-2xl text-center">
                        <p className="text-[10px] md:text-sm font-black text-yellow-700 uppercase tracking-widest">
                          <i className="fas fa-lock mr-2"></i> Alterações suspensas por encerramento do prazo.
                        </p>
                     </div>
                   )}
                   <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
                     <Button 
                        variant="outline" 
                        className={`flex-1 h-12 md:h-16 text-[10px] md:text-xs ${!isOrdersOpen ? 'opacity-30 cursor-not-allowed' : ''}`} 
                        onClick={() => isOrdersOpen && onEdit?.(order)}
                        disabled={!isOrdersOpen}
                     >
                       <i className="fas fa-edit"></i> EDITAR MEU PEDIDO
                     </Button>
                     <Button 
                        variant="primary" 
                        className="flex-1 h-12 md:h-16 text-[10px] md:text-xs" 
                        onClick={() => generateOrderPDF(order)}
                     >
                       <i className="fas fa-file-pdf"></i> OBTER PDF DO PEDIDO
                     </Button>
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
