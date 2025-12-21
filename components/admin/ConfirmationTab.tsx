
import React, { useState, useMemo } from 'react';
import { Confirmation } from '../../types';
import { Card, Input } from '../UI';

type FilterType = 'Todos' | 'Capital' | 'Interior';

interface ConfirmationTabProps {
    confirmations: Confirmation[];
    isLoading: boolean;
    onEdit: (confirmation: Confirmation) => void;
    onSync: () => void;
    isSyncing: boolean;
    searchText: string;
    setSearchText: (text: string) => void;
}

export const ConfirmationTab: React.FC<ConfirmationTabProps> = ({ confirmations, isLoading, onEdit, onSync, isSyncing, searchText, setSearchText }) => {
    const [filter, setFilter] = useState<FilterType>('Todos');

    const filteredConfirmations = useMemo(() => {
        return confirmations
            .filter(c => {
                // Search text filtering is now done on the server.
                // We only apply the type filter client-side.
                const matchesFilter = filter === 'Todos' || c.type === filter;
                return matchesFilter;
            })
            .sort((a, b) => a.docId.localeCompare(b.docId));
    }, [confirmations, filter]);

    const statusStyles = {
        none: 'bg-surface border-border-light',
        confirmed: 'bg-green-500/5 border-green-500/20',
        pending: 'bg-yellow-500/5 border-yellow-500/20',
    };
    
    const statusText = {
        none: 'Não Definido',
        confirmed: 'Confirmado',
        pending: 'Pendente',
    };
    
    const statusIcons = {
        none: 'fa-question-circle text-text-secondary/50',
        confirmed: 'fa-check-circle text-green-500',
        pending: 'fa-clock text-yellow-500',
    }

    if (isLoading) {
        return <LoadingPulse />;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
                    <div className="lg:col-span-2">
                        <Input 
                            label="Pesquisar por Setor ou Cidade" 
                            placeholder="Ex: SETOR A, Dourados..." 
                            value={searchText} 
                            onChange={e => setSearchText(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-3">
                        <label className="text-[10px] uppercase font-black tracking-widest text-primary/70 px-1">Filtrar Local</label>
                        <div className="flex gap-2">
                            {(['Todos', 'Capital', 'Interior'] as FilterType[]).map(f => (
                                <button 
                                    key={f} 
                                    onClick={() => setFilter(f)}
                                    className={`flex-1 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${filter === f ? 'bg-primary border-primary text-white' : 'border-border-light text-text-secondary hover:border-primary/30'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end border-t border-border-light pt-4">
                    <button 
                        onClick={onSync} 
                        disabled={isSyncing}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:text-text-primary disabled:opacity-50 transition-colors"
                    >
                        <i className={`fas fa-sync-alt ${isSyncing ? 'animate-spin' : ''}`}></i>
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar com Pedidos'}
                    </button>
                </div>
            </div>


            {filteredConfirmations.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredConfirmations.map(c => (
                        <Card 
                            key={c.docId} 
                            onClick={() => onEdit(c)}
                            className={`p-6 flex flex-col gap-4 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/40 ${statusStyles[c.status]}`}
                        >
                            <div className="flex-grow">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">{c.type}</p>
                                <h3 className="text-lg font-black text-text-primary uppercase tracking-tight">{c.docId}</h3>
                            </div>
                            <div className="border-t border-border-light pt-4 mt-auto flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <i className={`fas ${statusIcons[c.status]}`}></i>
                                    <span className="text-xs font-bold uppercase tracking-widest">{statusText[c.status]}</span>
                                </div>
                                {c.lastUpdated && (
                                     <span className="text-[9px] font-bold text-text-secondary/70">
                                         {new Date(c.lastUpdated).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                     </span>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};


const LoadingPulse: React.FC = () => (
    <div className="py-20 text-center animate-pulse">
        <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin mx-auto mb-6"></div>
        <p className="text-primary font-black text-[10px] uppercase tracking-[0.3em] opacity-60">Sincronizando Dados...</p>
    </div>
);
  
const EmptyState: React.FC = () => (
    <div className="py-20 text-center card border-dashed border-border-light flex flex-col items-center gap-6">
        <div className="w-14 h-14 rounded-2xl bg-background flex items-center justify-center text-xl text-text-secondary/40">
            <i className="fas fa-folder-open"></i>
        </div>
        <p className="text-text-secondary font-bold uppercase tracking-[0.3em] text-[10px]">Nenhum registro encontrado</p>
    </div>
);