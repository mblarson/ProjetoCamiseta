
import React, { useMemo } from 'react';
import { Order } from '../types';
import { Card, Button } from './UI';
import { INFANTIL_SIZES, ADULTO_SIZES } from '../constants';
import { generateSizeMatrixPDF } from '../services/pdfService';

interface SizeMatrixProps {
  orders: Order[];
  loading: boolean;
  onClose: () => void;
}

const CATEGORIES = ['infantil', 'babylook', 'unissex'] as const;
const COLORS = ['verdeOliva', 'terracota'] as const;

export const SizeMatrix: React.FC<SizeMatrixProps> = ({ orders, loading, onClose }) => {

  const matrixData = useMemo(() => {
    const data: any = {};
    const columnTotals: { [size: string]: number } = {};
    let grandTotal = 0;

    const allSizes = [...INFANTIL_SIZES, ...ADULTO_SIZES];

    // Initialize data structure
    CATEGORIES.forEach(cat => {
      data[cat] = { rowTotal: 0 };
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
                  data[cat].rowTotal += qty;
                  columnTotals[size] = (columnTotals[size] || 0) + qty;
                  grandTotal += qty;
                }
              });
            }
          });
        }
      });
    });

    return { data, columnTotals, grandTotal, allSizes };
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
    <Card className="p-6 md:p-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center">
                <i className="fas fa-ruler-combined text-primary text-xl"></i>
            </div>
            <div>
                <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Matriz de Tamanhos</h3>
                <p className="text-[10px] text-text-secondary font-bold uppercase tracking-[0.2em]">Resumo para Produção</p>
            </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button 
                variant="outline" 
                onClick={() => generateSizeMatrixPDF(orders)}
                className="flex-1 sm:flex-none text-[10px] h-12"
            >
                <i className="fas fa-file-pdf"></i> Baixar PDF
            </Button>
            <button 
                onClick={onClose} 
                className="w-12 h-12 rounded-full bg-surface hover:bg-background transition-colors text-text-secondary hover:text-primary"
                aria-label="Fechar matriz de tamanhos"
            >
                <i className="fas fa-times text-lg"></i>
            </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm text-left">
          <thead className="text-[10px] text-primary/80 uppercase tracking-widest">
            <tr>
              <th className="py-4 px-2 font-black">Categoria / Cor</th>
              {matrixData.allSizes.map(size => (
                <th key={size} className="py-4 px-2 text-center font-black">{size}</th>
              ))}
              <th className="py-4 px-2 text-center font-black bg-primary/10 text-primary">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {CATEGORIES.map((cat, catIndex) => (
              <React.Fragment key={cat}>
                {COLORS.map((color, colorIndex) => (
                  <tr key={color} className="hover:bg-background/50">
                    <td className="py-4 px-2 font-bold whitespace-nowrap">
                      {colorIndex === 0 && <span className="font-black text-primary uppercase tracking-widest text-xs block mb-1">{cat}</span>}
                      <span className="flex items-center gap-2 pl-2 text-text-secondary">
                        <div className={`w-2.5 h-2.5 rounded-full ${color === 'verdeOliva' ? 'bg-[#3b4a3c]' : 'bg-[#a35e47]'}`}></div>
                        {color === 'verdeOliva' ? 'Verde Oliva' : 'Terracota'}
                      </span>
                    </td>
                    {matrixData.allSizes.map(size => (
                      <td key={size} className="py-3 px-2 text-center text-text-primary/90 font-mono">
                        {(matrixData.data[cat][color][size] > 0) ? matrixData.data[cat][color][size] : <span className="text-text-secondary/30">-</span>}
                      </td>
                    ))}
                    <td className="py-3 px-2 text-center font-black text-primary bg-primary/10">
                      {matrixData.data[cat][color].subTotal}
                    </td>
                  </tr>
                ))}
                <tr className="bg-surface">
                   <td className="py-3 px-2 font-black text-text-secondary uppercase tracking-widest text-right">Subtotal {cat}</td>
                   {matrixData.allSizes.map(size => {
                     const sub = (matrixData.data[cat]['verdeOliva'][size] || 0) + (matrixData.data[cat]['terracota'][size] || 0);
                     return <td key={size} className="py-3 px-2 text-center font-bold text-text-secondary/80 font-mono">{sub > 0 ? sub : '-'}</td>
                   })}
                   <td className="py-3 px-2 text-center font-black text-primary bg-primary/10">{matrixData.data[cat].rowTotal}</td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
          <tfoot className="bg-surface border-t-2 border-primary/30">
            <tr>
              <td className="py-4 px-2 font-black text-primary uppercase tracking-widest text-sm">Total Geral</td>
              {matrixData.allSizes.map(size => (
                <td key={size} className="py-4 px-2 text-center font-black text-primary font-mono text-base">
                  {matrixData.columnTotals[size] || '-'}
                </td>
              ))}
              <td className="py-4 px-2 text-center font-black text-primary bg-primary/20 font-mono text-xl">
                {matrixData.grandTotal}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
};
