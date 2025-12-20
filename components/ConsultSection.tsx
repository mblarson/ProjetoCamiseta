
import React, { useState } from 'react';
import { Card, Input, Button } from './UI';
import { findOrder, findOrderByEmail } from '../services/firebase';
import { generateOrderPDF } from '../services/pdfService';
import { Order, ColorData } from '../types';

interface ConsultSectionProps {
  onEdit?: (order: Order) => void;
}

export const ConsultSection: React.FC<ConsultSectionProps> = ({ onEdit }) => {
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
        if (q > 0) items.push({ cat, size: s, qty: q });
      });
    });

    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase text-primary/60 tracking-widest">{label}</p>
        <div className="grid grid-cols-1 gap-1">
          {items.map((it, idx) => (
            <div key={idx} className="flex justify-between text-[11px] border-b border-border-light pb-1">
              <span className="text-text-secondary uppercase font-bold">{it.cat} ({it.size})</span>
              <span className="text-text-primary font-black">{it.qty}</span>
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
    <div className="max-w-4xl mx-auto animate-in zoom-in-95 duration-500">
      <Card className="p-10 md:p-14 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-16 -mt-16"></div>
        
        <div className="text-center mb-8 relative z-10">
          <h2 className="text-3xl md:text-5xl font-black mb-3 tracking-tighter text-text-primary uppercase">Consultar Pedido</h2>
          <p className="text-text-secondary text-[11px] font-bold uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
            Localize seu pedido usando o código ou seu e-mail de cadastro.
          </p>
        </div>
        
        <div className="space-y-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input 
              label="CÓDIGO DO PEDIDO" 
              placeholder="PED-XXXXXX" 
              value={id} 
              onChange={e => setId(e.target.value.toUpperCase())}
              disabled={loading}
              className="text-center font-black tracking-widest uppercase h-14 rounded-2xl"
            />
            <Input 
              label="E-MAIL CADASTRADO" 
              placeholder="seu@email.com" 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              className="text-center font-bold h-14 rounded-2xl"
            />
          </div>

          <Button 
            className="w-full h-16" 
            onClick={handleSearch}
            disabled={loading || (!id && !email)}
          >
            {loading ? <i className="fas fa-circle-notch fa-spin text-xl"></i> : "LOCALIZAR PEDIDO AGORA"}
          </Button>
          
          {searched && !order && (
            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold text-center animate-shake">
              Nenhum pedido encontrado com os dados informados.
            </div>
          )}

          {order && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500 pt-4">
              <div className="p-8 bg-background rounded-3xl border border-primary/40 space-y-8 shadow-inner">
                
                <div className="grid grid-cols-1 gap-1">
                    <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest">Código do Pedido</p>
                    <p className="text-text-primary font-black text-xl tracking-widest">{order.numPedido}</p>
                </div>

                <div className="grid grid-cols-1 gap-1">
                    <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest">Nome do Líder</p>
                    <p className="text-text-primary font-black text-lg uppercase">{order.nome}</p>
                </div>

                <div className="grid grid-cols-1 gap-1">
                    <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest">Localização - Setor</p>
                    <p className="text-primary font-black text-sm uppercase">{order.local} - {formatSetor(order)}</p>
                </div>

                <div className="pt-4 border-t border-border-light">
                   <p className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em] mb-4">Detalhamento do Pedido</p>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      {renderTableData("Verde Oliva", order.verdeOliva)}
                      {renderTableData("Terracota", order.terracota)}
                   </div>
                </div>

                <div className="pt-6 border-t border-border-light flex flex-col sm:flex-row gap-4">
                   <Button 
                      variant="outline" 
                      className="flex-1 h-12 text-[10px]" 
                      onClick={() => onEdit?.(order)}
                   >
                     <i className="fas fa-edit"></i> EDITAR PEDIDO
                   </Button>
                   <Button 
                      variant="primary" 
                      className="flex-1 h-12 text-[10px]" 
                      onClick={() => generateOrderPDF(order)}
                   >
                     <i className="fas fa-file-pdf"></i> BAIXAR PDF
                   </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
