
import React, { useMemo, useState, useEffect } from 'react';
import { Order, Stats } from '../types';
import { Card, Button, Modal, TextArea } from './UI';
import { INFANTIL_SIZES, BABYLOOK_SIZES, UNISSEX_SIZES, DEFAULT_PRICE } from '../constants';
import { generateSizeMatrixPDF } from '../services/pdfService';
import { getAllOrders, getGlobalConfig, getStats } from '../services/firebase';

interface SizeMatrixProps {
  onClose: () => void;
  batchNumber: number; // Agora obrigatório via prop
}

const CATEGORIES = ['unissex', 'babylook', 'infantil'] as const;
const COLORS = ['verdeOliva', 'terracota'] as const;

interface SelectedCellInfo {
  category: string;
  color: string;
  size: string;
  total: number;
}

export const SizeMatrix: React.FC<SizeMatrixProps> = ({ onClose, batchNumber }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [unitPrice, setUnitPrice] = useState(DEFAULT_PRICE);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<SelectedCellInfo | null>(null);
  
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [reportComment, setReportComment] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [ordersData, configData, statsData] = await Promise.all([
          getAllOrders(),
          getGlobalConfig(),
          getStats()
        ]);
        setOrders(ordersData);
        setUnitPrice(configData.valorCamiseta);
        setStats(statsData);
      } catch (error) {
        console.error("Failed to load size matrix data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const batchData = useMemo(() => {
    const data: any = {};
    let grandTotal = 0;
    let totalVerde = 0;
    let totalTerracota = 0;
    const allUniqueSizes = Array.from(new Set([...INFANTIL_SIZES, ...BABYLOOK_SIZES, ...UNISSEX_SIZES]));

    CATEGORIES.forEach(cat => {
      data[cat] = {};
      COLORS.forEach(color => {
        data[cat][color] = { subTotal: 0 };
        allUniqueSizes.forEach(size => {
          data[cat][color][size] = 0;
        });
      });
    });

    orders
      .filter(o => (o.lote || 1) === batchNumber)
      .forEach(order => {
        COLORS.forEach(color => {
          const colorData = order[color];
          if (colorData) {
            CATEGORIES.forEach(cat => {
              const categoryData = colorData[cat];
              if (categoryData) {
                Object.entries(categoryData).forEach(([size, qty]) => {
                  if (typeof qty === 'number') {
                    data[cat][color][size] = (data[cat][color][size] || 0) + qty;
                    data[cat][color].subTotal += qty;
                    grandTotal += qty;
                    if (color === 'verdeOliva') totalVerde += qty;
                    if (color === 'terracota') totalTerracota += qty;
                  }
                });
              }
            });
          }
        });
      });

    return { data, grandTotal, totalVerde, totalTerracota };
  }, [orders, batchNumber]);

  const contributors = useMemo(() => {
    if (!selectedCell) return [];
    return orders
      .filter(o => (o.lote || 1) === batchNumber)
      .map(o => {
        const colorData = o[selectedCell.color as keyof Order] as any;
        const qty = colorData?.[selectedCell.category]?.[selectedCell.size] || 0;
        const displaySetor = o.setor === 'UMADEMATS' ? o.setor : (o.local === 'Capital' ? `Setor ${o.setor}` : o.setor);
        return { id: o.docId, numPedido: o.numPedido, nome: o.nome, setor: displaySetor, local: o.local, qty };
      })
      .filter(c => c.qty > 0)
      .sort((a, b) => b.qty - a.qty);
  }, [selectedCell, orders, batchNumber]);

  const handleDownloadPDF = () => {
    const batchOrders = orders.filter(o => (o.lote || 1) === batchNumber);
    generateSizeMatrixPDF(batchOrders, unitPrice, stats, batchNumber, reportComment);
    setIsCommentModalOpen(false);
    setReportComment('');
  };

  if (loading) {
    return (
      <Card className="p-8 animate-pulse rounded-[2rem]">
        <div className="h-8 w-1/3 bg-surface rounded-lg mb-6"></div>
        <div className="space-y-4">
          <div className="h-12 w-full bg-surface rounded-lg"></div>
          <div className="h-12 w-full bg-surface rounded-lg"></div>
        </div>
      </Card>
    );
  }

  const { data, grandTotal, totalVerde, totalTerracota } = batchData;

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-border-light sticky top-20 bg-background/95 backdrop-blur z-30 pt-4">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-surface border border-border-light hover:bg-background transition-colors text-text-secondary hover:text-primary flex items-center justify-center">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <div>
              <h3 className="text-2xl font-black text-text-primary uppercase tracking-tight">Matriz de Produção</h3>
              <p className="text-[10px] text-text-secondary font-bold uppercase tracking-[0.2em]">Exibindo Lote {batchNumber}</p>
          </div>
        </div>
        <div className="w-full sm:w-auto">
          <Button variant="outline" onClick={() => setIsCommentModalOpen(true)} className="w-full text-[10px] h-12 rounded-2xl">
              <i className="fas fa-file-pdf"></i> Baixar PDF (Lote {batchNumber})
          </Button>
        </div>
      </div>
      
      <div className="space-y-12">
          {CATEGORIES.map(category => {
            const categoryHasData = COLORS.some(color => data[category][color].subTotal > 0);
            if (!categoryHasData) return null;
            let relevantSizes = category === 'infantil' ? INFANTIL_SIZES : (category === 'babylook' ? BABYLOOK_SIZES : UNISSEX_SIZES);
            
            return (
              <div key={category}>
                <div className="flex items-center gap-4 mb-6"><h2 className="text-lg font-black uppercase tracking-[0.3em] text-text-secondary">{category}</h2><div className="flex-grow h-px bg-border-light/50"></div></div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {COLORS.map(color => {
                    const colorData = data[category][color];
                    if (colorData.subTotal === 0) return null;
                    const colorHex = color === 'verdeOliva' ? '#556B2F' : '#a35e47';
                    return (
                      <Card key={`${category}-${color}`} className="overflow-hidden p-0 border border-border-light shadow-sm rounded-3xl">
                        <div className="p-5 border-b border-border-light/50 flex justify-between items-center bg-slate-50/50">
                          <h3 className="font-black text-base tracking-tight uppercase flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorHex }}></div>
                            {color === 'verdeOliva' ? 'Verde-Oliva' : 'Terracota'}
                          </h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-background">
                              <tr className="border-b border-border-light">
                                {relevantSizes.map(size => (
                                  <th key={size} className="text-center text-[10px] font-black uppercase tracking-widest text-text-secondary py-3 px-2 min-w-[40px]">{size}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                {relevantSizes.map(size => {
                                  const val = colorData[size] || 0;
                                  return (
                                    <td key={size} className={`text-center font-bold text-lg py-4 px-2 ${val > 0 ? 'text-text-primary cursor-pointer hover:bg-primary/5 transition-colors' : 'text-text-secondary/20'}`} onClick={() => val > 0 && setSelectedCell({ category, color, size, total: val })}>
                                      {val || '-'}
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div className="bg-background p-4 flex justify-end items-center gap-4 border-t border-border-light/50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Subtotal</span>
                            <span className="font-black text-xl text-primary">{colorData.subTotal}</span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="mt-8 pt-6 border-t border-border-light flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex gap-6">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#556B2F]"></div><span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">VERDE: {totalVerde}</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#a35e47]"></div><span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">TERRA: {totalTerracota}</span></div>
            </div>
            <div className="flex items-center gap-6"><span className="text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">Total Lote {batchNumber}</span><span className="text-4xl font-black text-primary tracking-tighter">{grandTotal}</span></div>
          </div>
      </div>

      <Modal isOpen={!!selectedCell} onClose={() => setSelectedCell(null)} title="Auditoria de Pedidos">
        <div className="space-y-6">
          <div className="p-4 bg-primary-light/50 border border-primary/20 rounded-2xl">
            <h4 className="text-sm font-black uppercase tracking-tight text-text-primary">{selectedCell?.color === 'verdeOliva' ? 'Verde Oliva' : 'Terracota'} • {selectedCell?.category} • Tam {selectedCell?.size}</h4>
          </div>
          <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
            {contributors.map((c) => (
              <div key={c.id} className="flex justify-between items-center p-4 border border-border-light rounded-xl bg-surface">
                <div><p className="text-xs font-black text-text-primary uppercase">{c.nome}</p><p className="text-[10px] font-bold text-text-secondary uppercase">{c.setor}</p></div>
                <div className="text-right"><p className="text-lg font-black text-primary tracking-tighter">{c.qty}</p></div>
              </div>
            ))}
          </div>
          <Button onClick={() => setSelectedCell(null)} variant="outline" className="w-full h-12 rounded-xl text-[10px]">FECHAR AUDITORIA</Button>
        </div>
      </Modal>

      <Modal isOpen={isCommentModalOpen} onClose={() => setIsCommentModalOpen(false)} title="Observações do Relatório">
        <div className="space-y-6 text-center">
          <TextArea placeholder="Nota opcional para o PDF..." value={reportComment} onChange={e => setReportComment(e.target.value)} />
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1 h-12 text-[10px]" onClick={() => setIsCommentModalOpen(false)}>CANCELAR</Button>
            <Button className="flex-1 h-12 text-[10px]" onClick={handleDownloadPDF}>GERAR PDF</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
