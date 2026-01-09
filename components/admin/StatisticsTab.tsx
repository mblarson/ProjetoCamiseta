
import { Order, ColorData } from '../../types';
import { Card, Button, Modal } from '../UI';
import React, { useMemo, useState, useEffect } from 'react';
import { getGlobalConfig } from '../../services/firebase';
import { generateSummaryBatchPDF } from '../../services/pdfService';

const getShirtCount = (order: Order) => {
    const calculate = (data?: ColorData) => {
        if (!data) return 0;
        let q = 0;
        Object.values(data).forEach(cat => {
            Object.values(cat).forEach(val => q += (val as number || 0));
        });
        return q;
    };
    return calculate(order.verdeOliva) + calculate(order.terracota);
};

interface StatHighlightCardProps {
    title: string;
    value: string;
    subValue: string;
    icon: string;
    color: 'green' | 'red' | 'blue';
}

const StatHighlightCard: React.FC<StatHighlightCardProps> = ({ title, value, subValue, icon, color }) => {
    const colorClasses = {
        green: {
            bg: 'bg-green-500/5',
            border: 'border-green-500/20',
            iconBg: 'bg-green-500/10',
            iconText: 'text-green-500',
            valueText: 'text-green-600',
        },
        red: {
            bg: 'bg-red-500/5',
            border: 'border-red-500/20',
            iconBg: 'bg-red-500/10',
            iconText: 'text-red-500',
            valueText: 'text-red-600',
        },
        blue: {
            bg: 'bg-blue-500/5',
            border: 'border-blue-500/20',
            iconBg: 'bg-blue-500/10',
            iconText: 'text-blue-500',
            valueText: 'text-blue-600',
        },
    };
    const currentTheme = colorClasses[color];

    const getFontSizeClass = (text: string) => {
        const len = text.length;
        if (len <= 10) return "text-3xl";
        if (len <= 15) return "text-2xl";
        if (len <= 20) return "text-xl";
        return "text-lg";
    };

    return (
        <Card className={`p-8 flex flex-col justify-between gap-6 h-full ${currentTheme.bg} ${currentTheme.border}`}>
            <div className="flex items-start justify-between">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-widest leading-tight">{title}</h3>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${currentTheme.iconBg} ${currentTheme.iconText}`}>
                    <i className={`fas ${icon}`}></i>
                </div>
            </div>
            <div className="text-right mt-auto">
                <p className={`${getFontSizeClass(value)} font-black tracking-tighter text-text-primary uppercase leading-tight break-words`}>
                    {value}
                </p>
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
        const initialResult = {
            topCityShirts: { name: 'N/D', count: 0, totalValue: 0 },
            topSectorShirts: { name: 'N/D', count: 0, totalValue: 0 },
            topCityDebt: { name: 'N/D', debt: 0 },
            topSectorDebt: { name: 'N/D', debt: 0 },
            topCityPaid: { name: 'N/D', paid: 0 },
            topSectorPaid: { name: 'N/D', paid: 0 },
        };

        if (!orders || orders.length === 0) {
            return initialResult;
        }

        const cityData: { [key: string]: { count: number, totalValue: number, paid: number, debt: number } } = {};
        const sectorData: { [key: string]: { count: number, totalValue: number, paid: number, debt: number } } = {};

        orders.forEach(order => {
            const key = order.setor;
            const shirtCount = getShirtCount(order);
            const paid = order.valorPago || 0;
            const debt = order.valorTotal - paid;
            const targetData = order.local === 'Interior' ? cityData : sectorData;

            if (!targetData[key]) targetData[key] = { count: 0, totalValue: 0, paid: 0, debt: 0 };
            
            targetData[key].count += shirtCount;
            targetData[key].totalValue += order.valorTotal;
            targetData[key].paid += paid;
            targetData[key].debt += debt > 0 ? debt : 0;
        });

        const findTopShirts = (data: typeof cityData) => {
            return Object.entries(data).reduce((top, [name, values]) => {
                if (values.count > top.count) return { name, count: values.count, totalValue: values.totalValue };
                if (values.count === top.count && values.totalValue > top.totalValue) return { name, count: values.count, totalValue: values.totalValue };
                return top;
            }, { name: 'N/D', count: 0, totalValue: 0 });
        };

        const findTopDebt = (data: typeof cityData) => {
            return Object.entries(data).reduce((top, [name, values]) => {
                if (values.debt > top.debt) return { name, debt: values.debt };
                return top;
            }, { name: 'N/D', debt: 0 });
        };

        const findTopPaid = (data: typeof cityData) => {
            return Object.entries(data).reduce((top, [name, values]) => {
                if (values.paid > top.paid) return { name, paid: values.paid };
                return top;
            }, { name: 'N/D', paid: 0 });
        };
        
        const topCityShirts = findTopShirts(cityData);
        const topSectorShirts = findTopShirts(sectorData);
        const topCityDebt = findTopDebt(cityData);
        const topSectorDebt = findTopDebt(sectorData);
        const topCityPaid = findTopPaid(cityData);
        const topSectorPaid = findTopPaid(sectorData);

        return {
            topCityShirts: { name: topCityShirts.name, count: topCityShirts.count, totalValue: topCityShirts.totalValue },
            topSectorShirts: { name: topSectorShirts.name !== 'N/D' ? (topSectorShirts.name === 'UMADEMATS' ? 'UMADEMATS' : `SETOR ${topSectorShirts.name}`) : 'N/D', count: topSectorShirts.count, totalValue: topSectorShirts.totalValue },
            topCityDebt: { name: topCityDebt.name, debt: topCityDebt.debt },
            topSectorDebt: { name: topSectorDebt.name !== 'N/D' ? (topSectorDebt.name === 'UMADEMATS' ? 'UMADEMATS' : `SETOR ${topSectorDebt.name}`) : 'N/D', debt: topSectorDebt.debt },
            topCityPaid: { name: topCityPaid.name, paid: topCityPaid.paid },
            topSectorPaid: { name: topSectorPaid.name !== 'N/D' ? (topSectorPaid.name === 'UMADEMATS' ? 'UMADEMATS' : `SETOR ${topSectorPaid.name}`) : 'N/D', paid: topSectorPaid.paid },
        };
    }, [orders]);

    const handleSelectBatch = (batch: number) => {
        setIsBatchModalOpen(false);
        generateSummaryBatchPDF(orders, batch);
    };

    if (isLoading) {
        return (
          <div className="py-20 text-center animate-pulse">
            <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin mx-auto mb-6"></div>
            <p className="text-primary font-black text-[10px] uppercase tracking-[0.3em] opacity-60">Analisando dados...</p>
          </div>
        );
    }

    if (orders.length === 0) {
        return (
          <div className="py-20 text-center card border-dashed border-border-light flex flex-col items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-background flex items-center justify-center text-xl text-text-secondary/40">
              <i className="fas fa-folder-open"></i>
            </div>
            <p className="text-text-secondary font-bold uppercase tracking-[0.3em] text-[10px]">Nenhum pedido para analisar</p>
          </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            {/* BOTÃO DO NOVO RELATÓRIO */}
            <div className="flex justify-start">
                <Button 
                    variant="outline" 
                    className="h-14 px-8 border-primary/30 hover:bg-primary-light"
                    onClick={() => setIsBatchModalOpen(true)}
                >
                    <i className="fas fa-file-pdf text-lg"></i>
                    RELATÓRIO GERAL DE PEDIDOS
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatHighlightCard
                    title="Cidade que Mais Pediu"
                    icon="fa-trophy"
                    color="green"
                    value={stats.topCityShirts.name}
                    subValue={`${stats.topCityShirts.count} camisetas • ${stats.topCityShirts.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                />
                <StatHighlightCard
                    title="Setor que Mais Pediu"
                    icon="fa-trophy"
                    color="green"
                    value={stats.topSectorShirts.name}
                    subValue={`${stats.topSectorShirts.count} camisetas • ${stats.topSectorShirts.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                />
                <StatHighlightCard
                    title="Setor com Maior Valor Pago"
                    icon="fa-hand-holding-dollar"
                    color="blue"
                    value={stats.topSectorPaid.name}
                    subValue={stats.topSectorPaid.paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                />
                <StatHighlightCard
                    title="Cidade com Maior Valor Pago"
                    icon="fa-hand-holding-dollar"
                    color="blue"
                    value={stats.topCityPaid.name}
                    subValue={stats.topCityPaid.paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                />
                <StatHighlightCard
                    title="Setor com Mais Débitos"
                    icon="fa-file-invoice-dollar"
                    color="red"
                    value={stats.topSectorDebt.name}
                    subValue={stats.topSectorDebt.debt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                />
                <StatHighlightCard
                    title="Cidade com Mais Débito"
                    icon="fa-file-invoice-dollar"
                    color="red"
                    value={stats.topCityDebt.name}
                    subValue={stats.topCityDebt.debt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                />
            </div>

            {/* MODAL DE SELEÇÃO DE LOTE */}
            <Modal 
                isOpen={isBatchModalOpen} 
                onClose={() => setIsBatchModalOpen(false)} 
                title="Selecione o Lote"
            >
                <div className="space-y-6 text-center">
                    <p className="text-sm text-text-secondary font-bold uppercase tracking-widest leading-relaxed">
                        Escolha o lote para gerar o relatório consolidado de pedidos.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4">
                        {availableBatches.map(batch => (
                            <button
                                key={batch}
                                onClick={() => handleSelectBatch(batch)}
                                className="h-16 rounded-2xl border-2 border-border-light hover:border-primary hover:bg-primary-light transition-all flex flex-col items-center justify-center group"
                            >
                                <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary group-hover:text-primary">LOTE</span>
                                <span className="text-xl font-black text-text-primary group-hover:text-primary">{batch}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>
        </div>
    );
};
