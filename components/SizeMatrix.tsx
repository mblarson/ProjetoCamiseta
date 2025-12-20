
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
        setStats(statsData);
      } catch (error) {
        console.error("Failed to load size matrix data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const matrixData = useMemo(() => {
    const data: any = {};
    let grandTotal = 0;

    const allSizes = [...INFANTIL_SIZES, ...ADULTO_SIZES];

    // Initialize data structure
    CATEGORIES.forEach(cat => {
      data[cat] = {};
      COLORS.forEach(color => {
        data[cat][color] = { subTotal: 0 };
        allSizes.forEach(size => {
          data[cat][color][size] = 0;
        });
      });
    });

    // Populate data from orders
    orders.forEach(order => {
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
  }, [orders]);

  if (loading) {
    return (
      <Card className="p-8 animate-pulse">
        <div className="h-8 w-1/3 bg-surface rounded-lg mb-6"></div>
        <div className="space-y-4">
          <div className="h-12 w-full bg-surface rounded-lg"></div>
          <div className="h-12 w-full bg-surface rounded-lg"></div>
          <div className="h-12 w-full bg-surface rounded-lg"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-border-light">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose} 
            className="w-12 h-12 rounded-full bg-surface border border-border-light hover:bg-background transition-colors text-text-secondary hover:text-primary flex items-center justify-center"
            aria-label="Voltar"
          >
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <div>
              <h3 className="text-2xl font-black text-text-primary uppercase tracking-tight">Matriz de Tamanhos</h3>
              <p className="text-[10px] text-text-secondary font-bold uppercase tracking-[0.2em]">Resumo para Produção</p>
          </div>
        </div>
        <div className="w-full sm:w-auto">
          <Button 
              variant="outline" 
              onClick={() => generateSizeMatrixPDF(orders, unitPrice, stats)}
              className="w-full text-[10px] h-12"
          >
              <i className="fas fa-file-pdf"></i> Baixar PDF
          </Button>
        </div>
      </div>
      
      <div className="space-y-12">
        {CATEGORIES.map(category => {
          const categoryHasData = COLORS.some(color => matrixData.data[category][color].subTotal > 0);
          if (!categoryHasData) return null;

          const relevantSizes = category === 'infantil' ? INFANTIL_SIZES : ADULTO_SIZES;
          
          return (
            <div key={category}>
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-grow h-px bg-border-light"></div>
                <h2 className="text-xl font-black uppercase tracking-[0.3em] text-text-primary text-center">
                  {category}
                </h2>
                <div className="flex-grow h-px bg-border-light"></div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {COLORS.map(color => {
                  const colorData = matrixData.data[category][color];
                  if (colorData.subTotal === 0) return null;

                  const colorName = color === 'verdeOliva' ? 'Verde-Oliva' : 'Terracota';
                  const colorHex = color === 'verdeOliva' ? '#556B2F' : '#a35e47';

                  return (
                    <Card key={color} className="overflow-hidden p-0">
                       <div className="p-6">
                         <h3 className="font-black text-lg tracking-tight" style={{ color: colorHex }}>{colorName}</h3>
                       </div>
                       <div className="overflow-x-auto">
                         <table className="w-full text-sm">
                           <thead className="bg-background">
                             <tr className="border-y border-border-light">
                               <th className="text-left text-[10px] font-black uppercase tracking-widest text-text-secondary py-3 px-4">TIPO</th>
                               {relevantSizes.map(size => (
                                 <th key={size} className="text-center text-[10px] font-black uppercase tracking-widest text-text-secondary py-3 px-2">{size}</th>
                               ))}
                             </tr>
                           </thead>
                           <tbody>
                             <tr className="border-b border-border-light">
                               <td className="font-bold py-4 px-4 text-text-primary capitalize">{category}</td>
                               {relevantSizes.map(size => (
                                 <td key={size} className="text-center font-bold text-lg py-4 px-2 text-text-primary">
                                   {colorData[size] || '-'}
                                 </td>
                               ))}
                             </tr>
                           </tbody>
                         </table>
                       </div>
                       <div className="bg-background p-4 flex justify-end items-center gap-4">
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
      </div>

      <div className="mt-12 pt-8 border-t border-primary/20 flex justify-end items-center gap-6">
        <span className="text-sm font-bold uppercase tracking-widest text-text-secondary">Total Geral de Camisetas</span>
        <span className="text-4xl font-black text-primary tracking-tighter">{matrixData.grandTotal}</span>
      </div>
    </div>
  );
};