
import React, { useMemo, useState, useEffect } from 'react';
import { Order, Stats } from '../types';
import { Card, Button } from './UI';
import { INFANTIL_SIZES, ADULTO_SIZES, DEFAULT_PRICE } from '../constants';
import { generateSizeMatrixPDF } from '../services/pdfService';
import { getAllOrders, getGlobalConfig, getStats } from '../services/firebase';

interface SizeMatrixProps {
  onClose: () => void;
}

const CATEGORIES = ['unissex', 'babylook', 'infantil'] as const;
const COLORS = ['verdeOliva', 'terracota'] as const;

export const SizeMatrix: React.FC<SizeMatrixProps> = ({ onClose }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [unitPrice, setUnitPrice] = useState(DEFAULT_PRICE);
  const [currentBatch, setCurrentBatch] = useState(1);
  const [loading, setLoading] = useState(true);

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
        setCurrentBatch(configData.currentBatch);
        setStats(statsData);
      } catch (error) {
        console.error("Failed to load size matrix data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Processa APENAS o lote ativo
  const activeBatchData = useMemo(() => {
    const data: any = {};
    let grandTotal = 0;
    const allSizes = [...INFANTIL_SIZES, ...ADULTO_SIZES];

    // Inicializa estrutura
    CATEGORIES.forEach(cat => {
      data[cat] = {};
      COLORS.forEach(color => {
        data[cat][color] = { subTotal: 0 };
        allSizes.forEach(size => {
          data[cat][color][size] = 0;
        });
      });
    });

    // Filtra e popula dados apenas do lote atual
    orders
      .filter(o => (o.lote || 1) === currentBatch)
      .forEach(order => {
        COLORS.forEach(color => {
          const colorData = order[color];
          if (colorData) {
            CATEGORIES.forEach(cat => {
              const categoryData = colorData[cat];
              if (categoryData) {
                Object.entries(categoryData).forEach(([size, qty]) => {
                  if (typeof qty === 'number' && allSizes.includes(size)) {
                    data[cat][color][size] += qty;
                    data[cat][color].subTotal += qty;
                    grandTotal += qty;
                  }
                });
              }
            });
          }
        });
      });

    return { data, grandTotal };
  }, [orders, currentBatch]);

  const handleDownloadPDF = () => {
    const activeBatchOrders = orders.filter(o => (o.lote || 1) === currentBatch);
    generateSizeMatrixPDF(activeBatchOrders, unitPrice, stats, currentBatch);
  };

  if (loading) {
    return (
      <Card className="p-8 animate-pulse rounded-[2rem]">
        <div className="h-8 w-1/3 bg-surface rounded-lg mb-6"></div>
        <div className="space-y-4">
          <div className="h-12 w-full bg-surface rounded-lg"></div>
          <div className="h-12 w-full bg-surface rounded-lg"></div>
          <div className="h-12 w-full bg-surface rounded-lg"></div>
        </div>
      </Card>
    );
  }

  const { data, grandTotal } = activeBatchData;

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-border-light sticky top-20 bg-background/95 backdrop-blur z-30 pt-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose} 
            className="w-12 h-12 rounded-full bg-surface border border-border-light hover:bg-background transition-colors text-text-secondary hover:text-primary flex items-center justify-center"
            aria-label="Voltar"
          >
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <div>
              <h3 className="text-2xl font-black text-text-primary uppercase tracking-tight">Matriz de Produção</h3>
              <p className="text-[10px] text-text-secondary font-bold uppercase tracking-[0.2em]">Detalhado por Lote</p>
          </div>
        </div>
        <div className="w-full sm:w-auto">
          <Button 
              variant="outline" 
              onClick={handleDownloadPDF}
              className="w-full text-[10px] h-12 rounded-2xl"
          >
              <i className="fas fa-file-pdf"></i> Baixar PDF (Lote {currentBatch})
          </Button>
        </div>
      </div>
      
      <div className="space-y-12">
          {CATEGORIES.map(category => {
            const categoryHasData = COLORS.some(color => data[category][color].subTotal > 0);
            if (!categoryHasData) return null;

            const relevantSizes = category === 'infantil' ? INFANTIL_SIZES : ADULTO_SIZES;
            
            return (
              <div key={category}>
                <div className="flex items-center gap-4 mb-6">
                  <h2 className="text-lg font-black uppercase tracking-[0.3em] text-text-secondary">
                    {category}
                  </h2>
                  <div className="flex-grow h-px bg-border-light/50"></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {COLORS.map(color => {
                    const colorData = data[category][color];
                    if (colorData.subTotal === 0) return null;

                    const colorName = color === 'verdeOliva' ? 'Verde-Oliva' : 'Terracota';
                    const colorHex = color === 'verdeOliva' ? '#556B2F' : '#a35e47';

                    return (
                      <Card key={`${category}-${color}`} className="overflow-hidden p-0 border border-border-light shadow-sm rounded-3xl">
                        <div className="p-5 border-b border-border-light/50 flex justify-between items-center bg-slate-50/50">
                          <h3 className="font-black text-base tracking-tight uppercase flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorHex }}></div>
                            {colorName}
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
                                {relevantSizes.map(size => (
                                  <td key={size} className={`text-center font-bold text-lg py-4 px-2 ${colorData[size] > 0 ? 'text-text-primary' : 'text-text-secondary/20'}`}>
                                    {colorData[size] || '-'}
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div className="bg-background p-4 flex justify-end items-center gap-4 border-t border-border-light/50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Total Cor/Categ.</span>
                            <span className="font-black text-xl text-primary">{colorData.subTotal}</span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="mt-8 pt-6 border-t border-border-light flex justify-end items-center gap-6">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">Total Camisetas (Lote {currentBatch})</span>
            <span className="text-4xl font-black text-primary tracking-tighter">{grandTotal}</span>
          </div>
      </div>
    </div>
  );
};
