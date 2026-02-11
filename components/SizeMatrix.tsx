import React, { useMemo, useState, useEffect } from 'react';
import { Order, Stats } from '../types';
import { Card, Button, Modal, TextArea } from './UI';
import { INFANTIL_SIZES, BABYLOOK_SIZES, UNISSEX_SIZES, DEFAULT_PRICE } from '../constants';
import { generateSizeMatrixPDF } from '../services/pdfService';
import { getAllOrders, getGlobalConfig, getStats } from '../services/firebase';

interface SizeMatrixProps {
  onClose: () => void;
}

const CATEGORIES = ['unissex', 'babylook', 'infantil'] as const;
const COLORS = ['verdeOliva', 'terracota'] as const;

interface SelectedCellInfo {
  category: string;
  color: string;
  size: string;
  total: number;
}

export const SizeMatrix: React.FC<SizeMatrixProps> = ({ onClose }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [unitPrice, setUnitPrice] = useState(DEFAULT_PRICE);
  const [availableBatches, setAvailableBatches] = useState<number[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<number | 'Geral' | null>(null); 
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
        
        const batches = Array.from({ length: configData.currentBatch }, (_, i) => i + 1);
        setAvailableBatches(batches);
        setStats(statsData);
      } catch (error) {
        console.error("Failed to load size matrix data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const batchDataResult = useMemo(() => {
    if (selectedBatch === null) return null;

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
      .filter(o => selectedBatch === 'Geral' || (o.lote || 1) === selectedBatch)
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
  }, [orders, selectedBatch]);

  const contributors = useMemo(() => {
    if (!selectedCell || selectedBatch === null || selectedBatch === 'Geral') return [];
    
    return orders
      .filter(o => (o.lote || 1) === selectedBatch)
      .map(o => {
        const colorData = o[selectedCell.color as keyof Order] as any;
        const qty = colorData?.[selectedCell.category]?.[selectedCell.size] || 0;
        const displaySetor = o.setor === 'UMADEMATS' ? o.setor : (o.local === 'Capital' ? `Setor ${o.setor}` : o.setor);

        return {
          id: o.docId,
          numPedido: o.numPedido,
          nome: o.nome,
          setor: displaySetor,
          local: o.local,
          qty
        };
      })
      .filter(c => c.qty > 0)
      .sort((a, b) => b.qty - a.qty);
  }, [selectedCell, orders, selectedBatch]);

  const handleDownloadPDF = () => {
    if (selectedBatch === null) return;
    const reportOrders = selectedBatch === 'Geral' ? orders : orders.filter(o => (o.lote || 1) === selectedBatch);
    generateSizeMatrixPDF(reportOrders, unitPrice, stats, selectedBatch, reportComment);
    setIsCommentModalOpen(false);
    setReportComment('');
  };

  if (loading) {
    return (
      <Card className="p-6 sm:p-8 animate-pulse rounded-2xl sm:rounded-[2rem]">
        <div className="h-6 sm:h-8 w-1/3 bg-surface rounded-lg mb-6"></div>
        <div className="space-y-4">
          <div className="h-10 sm:h-12 w-full bg-surface rounded-lg"></div>
          <div className="h-10 sm:h-12 w-full bg-surface rounded-lg"></div>
        </div>
      </Card>
    );
  }

  if (selectedBatch === null) {
    return (
      <div className="max-w-4xl mx-auto py-6 sm:py-12 animate-in fade-in duration-500 px-4">
        <div className="flex items-center gap-4 sm:gap-6 mb-8 sm:mb-12">
          <button 
            onClick={onClose} 
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface border border-border-light hover:bg-background transition-colors text-text-secondary hover:text-primary flex items-center justify-center"
          >
            <i className="fas fa-arrow-left text-sm sm:text-base"></i>
          </button>
          <h2 className="text-xl sm:text-3xl font-black text-text-primary uppercase tracking-tight">Relatório de Produção</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <button
              onClick={() => setSelectedBatch('Geral')}
              className="group relative overflow-hidden card p-6 sm:p-10 flex flex-col items-center justify-center gap-3 sm:gap-4 hover:border-primary transition-all hover:-translate-y-1 border-2 bg-primary/5 rounded-[1.5rem] sm:rounded-[2rem]"
            >
              <div className="absolute top-0 right-0 w-12 sm:w-16 h-12 sm:h-16 bg-primary/10 rounded-bl-full -mr-6 sm:-mr-8 -mt-6 sm:-mt-8"></div>
              <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-primary">Consolidado</span>
              <span className="text-2xl sm:text-4xl font-black text-primary tracking-tighter">TOTAL GERAL</span>
              <div className="mt-2 sm:mt-4 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-[8px] sm:text-[9px] font-black uppercase tracking-widest opacity-0 sm:group-hover:opacity-100 transition-opacity">
                Acessar Matriz
              </div>
          </button>

          {availableBatches.map(batch => (
            <button
              key={batch}
              onClick={() => setSelectedBatch(batch)}
              className="group relative overflow-hidden card p-6 sm:p-10 flex flex-col items-center justify-center gap-3 sm:gap-4 hover:border-primary transition-all hover:-translate-y-1 border-2 rounded-[1.5rem] sm:rounded-[2rem]"
            >
              <div className="absolute top-0 right-0 w-12 sm:w-16 h-12 sm:h-16 bg-primary/5 rounded-bl-full -mr-6 sm:-mr-8 -mt-6 sm:-mt-8"></div>
              <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-text-secondary">Produção</span>
              <span className="text-4xl sm:text-6xl font-black text-text-primary group-hover:text-primary tracking-tighter">{batch}</span>
              <div className="mt-2 sm:mt-4 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-[8px] sm:text-[9px] font-black uppercase tracking-widest opacity-0 sm:group-hover:opacity-100 transition-opacity">
                Visualizar Lote {batch}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const { data, grandTotal, totalVerde, totalTerracota } = batchDataResult!;
  const isGlobalView = selectedBatch === 'Geral';

  return (
    <div className="animate-in fade-in duration-500 pb-20 px-2 sm:px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-border-light sticky top-[60px] sm:top-20 bg-background/95 backdrop-blur z-30 pt-2 sm:pt-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button 
            onClick={() => setSelectedBatch(null)} 
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface border border-border-light hover:bg-background transition-colors text-text-secondary hover:text-primary flex items-center justify-center"
          >
            <i className="fas fa-chevron-left text-sm sm:text-lg"></i>
          </button>
          <div>
              <h3 className="text-xl sm:text-2xl font-black text-text-primary uppercase tracking-tight">
                {isGlobalView ? 'Total Geral' : `Lote ${selectedBatch}`}
              </h3>
              <p className="text-[8px] sm:text-[10px] text-text-secondary font-bold uppercase tracking-[0.2em]">
                {isGlobalView ? 'Matriz Consolidada' : 'Matriz de Produção'}
              </p>
          </div>
        </div>
        <div className="w-full sm:w-auto">
          <Button 
              variant="outline" 
              onClick={() => setIsCommentModalOpen(true)}
              className="w-full text-[9px] sm:text-[10px] h-10 sm:h-12 rounded-xl sm:rounded-2xl"
          >
              <i className="fas fa-file-pdf"></i> Baixar PDF {isGlobalView ? '' : `Lote ${selectedBatch}`}
          </Button>
        </div>
      </div>
      
      <div className="space-y-8 sm:space-y-12">
          {CATEGORIES.map(category => {
            const categoryHasData = COLORS.some(color => data[category][color].subTotal > 0);
            if (!categoryHasData) return null;

            let relevantSizes: string[];
            if (category === 'infantil') relevantSizes = INFANTIL_SIZES;
            else if (category === 'babylook') relevantSizes = BABYLOOK_SIZES;
            else relevantSizes = UNISSEX_SIZES;
            
            return (
              <div key={category} className="space-y-4 sm:space-y-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <h2 className="text-base sm:text-lg font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-text-secondary">
                    {category}
                  </h2>
                  <div className="flex-grow h-px bg-border-light/50"></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                  {COLORS.map(color => {
                    const colorData = data[category][color];
                    if (colorData.subTotal === 0) return null;

                    const colorName = color === 'verdeOliva' ? 'Verde-Oliva' : 'Terracota';
                    const colorHex = color === 'verdeOliva' ? '#556B2F' : '#a35e47';

                    return (
                      <Card key={`${category}-${color}`} className="overflow-hidden p-0 border border-border-light shadow-sm rounded-2xl sm:rounded-3xl">
                        <div className="p-4 sm:p-5 border-b border-border-light/50 flex justify-between items-center bg-slate-50/50">
                          <h3 className="font-black text-sm sm:text-base tracking-tight uppercase flex items-center gap-2 sm:gap-3">
                            <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full" style={{ backgroundColor: colorHex }}></div>
                            {colorName}
                          </h3>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar no-scrollbar">
                          <table className="w-full text-xs sm:text-sm">
                            <thead className="bg-background">
                              <tr className="border-b border-border-light">
                                {relevantSizes.map(size => (
                                  <th key={size} className="text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-text-secondary py-2 sm:py-3 px-2 min-w-[35px] sm:min-w-[40px]">{size}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                {relevantSizes.map(size => {
                                  const val = colorData[size] || 0;
                                  return (
                                    <td 
                                      key={size} 
                                      className={`text-center font-bold text-base sm:text-lg py-3 sm:py-4 px-2 ${val > 0 ? 'text-text-primary transition-colors' : 'text-text-secondary/20'} ${!isGlobalView && val > 0 ? 'cursor-pointer hover:bg-primary/5' : ''}`}
                                      onClick={() => !isGlobalView && val > 0 && setSelectedCell({ category, color, size, total: val })}
                                    >
                                      {val || '-'}
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div className="bg-background p-3 sm:p-4 flex justify-end items-center gap-3 sm:gap-4 border-t border-border-light/50">
                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-text-secondary">Subtotal</span>
                            <span className="font-black text-lg sm:text-xl text-primary">{colorData.subTotal}</span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="mt-6 sm:mt-8 pt-6 border-t border-border-light flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-6">
            <div className="flex gap-4 sm:gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 h-3 rounded-full bg-[#556B2F]"></div>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-text-secondary">VERDE: {totalVerde}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 h-3 rounded-full bg-[#a35e47]"></div>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-text-secondary">TERRA: {totalTerracota}</span>
              </div>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-text-secondary">
                {isGlobalView ? 'Total Geral' : `Total Lote ${selectedBatch}`}
              </span>
              <span className="text-3xl sm:text-4xl font-black text-primary tracking-tighter">{grandTotal}</span>
            </div>
          </div>
      </div>

      <Modal 
        isOpen={!!selectedCell} 
        onClose={() => setSelectedCell(null)}
        title="Auditoria de Pedidos"
      >
        <div className="space-y-4 sm:space-y-6">
          <div className="p-3 sm:p-4 bg-primary-light/50 border border-primary/20 rounded-xl sm:rounded-2xl">
            <div className="flex justify-between items-center mb-0.5 sm:mb-1">
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary">Composição da Célula</p>
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-text-secondary">Total: {selectedCell?.total}</p>
            </div>
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-tight text-text-primary truncate">
              {selectedCell?.color === 'verdeOliva' ? 'Verde' : 'Terra'} • {selectedCell?.category} • T-{selectedCell?.size}
            </h4>
          </div>

          <div className="space-y-2 sm:space-y-3 max-h-[35vh] overflow-y-auto pr-1 custom-scrollbar">
            {contributors.map((c, idx) => (
              <div key={c.id} className="flex justify-between items-center p-3 sm:p-4 border border-border-light rounded-xl bg-surface hover:bg-white transition-colors">
                <div className="max-w-[70%] overflow-hidden">
                  <p className="text-[10px] sm:text-xs font-black text-text-primary uppercase tracking-tight truncate">{c.nome}</p>
                  <p className="text-[9px] sm:text-[10px] font-bold text-text-secondary uppercase tracking-widest truncate">{c.setor}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base sm:text-lg font-black text-primary tracking-tighter">{c.qty}</p>
                  <p className="text-[7px] sm:text-[8px] font-black text-text-secondary/40 uppercase">un.</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 sm:pt-4 border-t border-border-light flex justify-between items-center">
            <p className="text-[9px] sm:text-[10px] font-black text-text-secondary uppercase tracking-widest">Soma Verificada</p>
            <p className="text-lg sm:text-xl font-black text-text-primary tracking-tighter">{selectedCell?.total}</p>
          </div>
          
          <Button onClick={() => setSelectedCell(null)} variant="outline" className="w-full h-10 sm:h-12 rounded-xl text-[9px] sm:text-[10px]">FECHAR</Button>
        </div>
      </Modal>

      <Modal isOpen={isCommentModalOpen} onClose={() => setIsCommentModalOpen(false)} title="Observações do PDF">
        <div className="space-y-4 sm:space-y-6">
          <p className="text-[10px] sm:text-[11px] text-text-secondary font-bold uppercase tracking-widest text-center">
            Adicione uma nota opcional para o relatório {isGlobalView ? 'geral' : `do Lote ${selectedBatch}`}.
          </p>
          <TextArea 
            placeholder="Ex: Instruções de separação, observações de prazo, etc." 
            value={reportComment}
            onChange={e => setReportComment(e.target.value)}
          />
          <div className="flex gap-3 sm:gap-4">
            <Button variant="outline" className="flex-1 h-10 sm:h-12 text-[9px] sm:text-[10px]" onClick={() => setIsCommentModalOpen(false)}>CANCELAR</Button>
            <Button className="flex-1 h-10 sm:h-12 text-[9px] sm:text-[10px]" onClick={handleDownloadPDF}>GERAR PDF</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};