
import { Order, ColorData } from '../../types';
import { Card, Button, Modal } from '../UI';
import React, { useMemo, useState, useEffect } from 'react';
import { getGlobalConfig, calculateShirtCount } from '../../services/firebase';
import { generateSummaryBatchPDF } from '../../services/pdfService';

interface StatHighlightCardProps {
    title: string;
    value: string;
    subValue: string;
    icon: string;
    color: 'green' | 'red' | 'blue';
}

const StatHighlightCard: React.FC<StatHighlightCardProps> = ({ title, value, subValue, icon, color }) => {
    const colorClasses = {
        green: { bg: 'bg-green-500/5', border: 'border-green-500/20', iconText: 'text-green-500', valueText: 'text-green-600' },
        red: { bg: 'bg-red-500/5', border: 'border-red-500/20', iconText: 'text-red-500', valueText: 'text-red-600' },
        blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', iconText: 'text-blue-500', valueText: 'text-blue-600' },
    };
    const currentTheme = colorClasses[color];

    return (
        <Card className={`p-8 flex flex-col justify-between gap-6 h-full ${currentTheme.bg} ${currentTheme.border}`}>
            <div className="flex items-start justify-between">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-widest">{title}</h3>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${currentTheme.iconText}`}>
                    <i className={`fas ${icon}`}></i>
                </div>
            </div>
            <div className="text-right mt-auto">
                <p className="text-2xl font-black text-text-primary uppercase tracking-tighter">{value}</p>
                <p className={`text-sm font-bold ${currentTheme.valueText}`}>{subValue}</p>
            </div>
        </Card>
    );
};

export const StatisticsTab: React.FC<{ orders: Order[], isLoading: boolean }> = ({ orders, isLoading }) => {
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [availableBatches, setAvailableBatches] = useState<number[]>([]);

    useEffect(() => {
        getGlobalConfig().then(config => {
            const batches = Array.from({ length: config.currentBatch }, (_, i) => i + 1);
            setAvailableBatches(batches);
        });
    }, []);

    const stats = useMemo(() => {
        const cityData: any = {};
        const sectorData: any = {};

        orders.forEach(order => {
            const key = order.setor;
            const shirtCount = calculateShirtCount(order);
            const target = order.local === 'Interior' ? cityData : sectorData;

            if (!target[key]) target[key] = { count: 0, total: 0, paid: 0 };
            target[key].count += shirtCount;
            target[key].total += order.valorTotal;
            target[key].paid += (order.valorPago || 0);
        });

        const findTop = (data: any) => Object.entries(data).reduce((top: any, [name, v]: any) => {
            return v.count > top.count ? { name, count: v.count, total: v.total } : top;
        }, { name: 'N/D', count: 0, total: 0 });

        const topCity = findTop(cityData);
        const topSector = findTop(sectorData);

        return { topCity, topSector };
    }, [orders]);

    if (isLoading) return <div className="py-20 text-center animate-pulse">Processando dados...</div>;

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex justify-start">
                <Button variant="outline" onClick={() => setIsBatchModalOpen(true)}>
                    <i className="fas fa-file-pdf"></i> RELATÓRIO GERAL
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatHighlightCard title="Cidade Top" icon="fa-trophy" color="green" value={stats.topCity.name} subValue={`${stats.topCity.count} camisetas`} />
                <StatHighlightCard title="Setor Top" icon="fa-trophy" color="green" value={stats.topSector.name} subValue={`${stats.topSector.count} camisetas`} />
            </div>
            
            <Modal isOpen={isBatchModalOpen} onClose={() => setIsBatchModalOpen(false)} title="Selecione o Lote">
                <div className="grid grid-cols-3 gap-4 p-4">
                    {availableBatches.map(b => (
                        <Button key={b} onClick={() => { setIsBatchModalOpen(false); generateSummaryBatchPDF(orders, b); }}>LOTE {b}</Button>
                    ))}
                </div>
            </Modal>
        </div>
    );
};
