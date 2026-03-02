
import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { Card, Button } from './UI';
import { generateOrderSeparationPDF } from '../services/pdfService';
import { getAllOrders, getGlobalConfig } from '../services/firebase';

interface OrderSeparationProps {
  onClose: () => void;
}

export const OrderSeparation: React.FC<OrderSeparationProps> = ({ onClose }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [availableBatches, setAvailableBatches] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [ordersData, configData] = await Promise.all([
          getAllOrders(),
          getGlobalConfig()
        ]);
        setOrders(ordersData);
        const batches = Array.from({ length: configData.currentBatch }, (_, i) => i + 1);
        setAvailableBatches(batches);
      } catch (error) {
        console.error("Failed to load order separation data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSelectBatch = (batch: number) => {
    generateOrderSeparationPDF(orders, batch);
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

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-12 animate-in fade-in duration-500 px-4">
      <div className="flex items-center gap-4 sm:gap-6 mb-8 sm:mb-12">
        <button 
          onClick={onClose} 
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface border border-border-light hover:bg-background transition-colors text-text-secondary hover:text-primary flex items-center justify-center"
        >
          <i className="fas fa-arrow-left text-sm sm:text-base"></i>
        </button>
        <h2 className="text-xl sm:text-3xl font-black text-text-primary uppercase tracking-tight">Separação de Pedidos</h2>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        {availableBatches.map(batch => (
          <button
            key={batch}
            onClick={() => handleSelectBatch(batch)}
            className="group relative overflow-hidden card p-6 sm:p-10 flex flex-col items-center justify-center gap-3 sm:gap-4 hover:border-primary transition-all hover:-translate-y-1 border-2 rounded-[1.5rem] sm:rounded-[2rem]"
          >
            <div className="absolute top-0 right-0 w-12 sm:w-16 h-12 sm:h-16 bg-primary/5 rounded-bl-full -mr-6 sm:-mr-8 -mt-6 sm:-mt-8"></div>
            <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-text-secondary">Produção</span>
            <span className="text-4xl sm:text-6xl font-black text-text-primary group-hover:text-primary tracking-tighter">{batch}</span>
            <div className="mt-2 sm:mt-4 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-[8px] sm:text-[9px] font-black uppercase tracking-widest opacity-0 sm:group-hover:opacity-100 transition-opacity">
              Gerar PDF Lote {batch}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
