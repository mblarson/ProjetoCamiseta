
import React, { useMemo } from 'react';
import { Order, ColorData } from '../../types';
import { Card } from '../UI';

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
    color: 'green' | 'red';
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
    };
    const currentTheme = colorClasses[color];

    return (
        <Card className={`p-8 flex flex-col justify-between gap-6 h-full ${currentTheme.bg} ${currentTheme.border}`}>
            <div className="flex items-start justify-between">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-widest leading-tight">{title}</h3>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${currentTheme.iconBg} ${currentTheme.iconText}`}>
                    <i className={`fas ${icon}`}></i>
                </div>
            </div>
            <div className="text-right mt-auto">
                <p className="text-4xl font-black tracking-tighter text-text-primary">{value}</p>
                <p className={`text-sm font-bold ${currentTheme.valueText}`}>{subValue}</p>
            </div>
        </Card>
    );
};

export const StatisticsTab: React.FC<{ orders: Order[], isLoading: boolean }> = ({ orders, isLoading }) => {
    const stats = useMemo(() => {
        const initialResult = {
            topCityShirts: { name: 'N/D', count: 0, totalValue: 0 },
            topSectorShirts: { name: 'N/D', count: 0, totalValue: 0 },
            topCityDebt: { name: 'N/D', debt: 0 },
            topSectorDebt: { name: 'N/D', debt: 0 },
        };

        if (!orders || orders.length === 0) {
            return initialResult;
        }

        const cityData: { [key: string]: { count: number, totalValue: number, debt: number } } = {};
        const sectorData: { [key: string]: { count: number, totalValue: number, debt: number } } = {};

        orders.forEach(order => {
            const key = order.setor;
            const shirtCount = getShirtCount(order);
            const debt = order.valorTotal - (order.valorPago || 0);
            const targetData = order.local === 'Interior' ? cityData : sectorData;

            if (!targetData[key]) targetData[key] = { count: 0, totalValue: 0, debt: 0 };
            
            targetData[key].count += shirtCount;
            targetData[key].totalValue += order.valorTotal;
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
        
        const topCityShirts = findTopShirts(cityData);
        const topSectorShirts = findTopShirts(sectorData);
        const topCityDebt = findTopDebt(cityData);
        const topSectorDebt = findTopDebt(sectorData);

        return {
            topCityShirts: { name: topCityShirts.name, count: topCityShirts.count, totalValue: topCityShirts.totalValue },
            topSectorShirts: { name: topSectorShirts.name !== 'N/D' ? `SETOR ${topSectorShirts.name}` : 'N/D', count: topSectorShirts.count, totalValue: topSectorShirts.totalValue },
            topCityDebt: { name: topCityDebt.name, debt: topCityDebt.debt },
            topSectorDebt: { name: topSectorDebt.name !== 'N/D' ? `SETOR ${topSectorDebt.name}` : 'N/D', debt: topSectorDebt.debt },
        };
    }, [orders]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-500">
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
    );
};