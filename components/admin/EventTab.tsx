
import React, { useState } from 'react';
import { createNewBatch, deleteLastBatch } from '../../services/firebase';
import { Modal, Button } from '../UI';

interface EventTabProps {
  config: { pedidosAbertos: boolean; valorCamiseta: number; currentBatch: number };
  setNewPrice: (price: string) => void;
  setIsPriceModalOpen: (isOpen: boolean) => void;
  formatNumberToCurrency: (value: number) => string;
  setSecurityModal: (modalInfo: { type: 'lock' | 'unlock' | 'end' | 'price' | null; password: string; newValue?: any }) => void;
}

export const EventTab: React.FC<EventTabProps> = ({
  config,
  setNewPrice,
  setIsPriceModalOpen,
  formatNumberToCurrency,
  setSecurityModal,
}) => {
    const [batchModal, setBatchModal] = useState<'create' | 'delete' | null>(null);
    const [newBatchNumber, setNewBatchNumber] = useState<number>(config.currentBatch + 1);
    const [isLoadingBatch, setIsLoadingBatch] = useState(false);

    const handleCreateBatch = async () => {
        setIsLoadingBatch(true);
        const success = await createNewBatch(newBatchNumber);
        if (success) {
            alert(`Lote ${newBatchNumber} criado com sucesso! O sistema agora está recebendo pedidos para o novo lote.`);
            setBatchModal(null);
            window.location.reload(); // Recarrega para garantir sync limpo
        } else {
            alert("Erro ao criar novo lote.");
        }
        setIsLoadingBatch(false);
    };

    const handleDeleteBatch = async () => {
        if (!confirm(`TEM CERTEZA? Isso excluirá TODOS os pedidos e confirmações do Lote ${config.currentBatch} e voltará o sistema para o Lote ${config.currentBatch - 1}.`)) return;
        
        setIsLoadingBatch(true);
        const success = await deleteLastBatch();
        if (success) {
            alert("Lote revertido com sucesso.");
            setBatchModal(null);
            window.location.reload();
        } else {
            alert("Erro ao excluir lote ou lote inválido para exclusão.");
        }
        setIsLoadingBatch(false);
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <EventActionCard 
                icon="fa-money-bill-1-wave" 
                title="Valor Unitário" 
                desc={config.valorCamiseta.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}
                highlightDesc
                onClick={() => {
                setNewPrice(formatNumberToCurrency(config.valorCamiseta));
                setIsPriceModalOpen(true);
                }}
            />

            {config.pedidosAbertos ? (
                <EventActionCard 
                icon="fa-lock" 
                title="Fechar Pedidos" 
                desc=""
                onClick={() => setSecurityModal({ type: 'lock', password: '' })}
                />
            ) : (
                <EventActionCard 
                icon="fa-lock-open" 
                title="Reabrir Pedidos" 
                desc=""
                variant="success"
                onClick={() => setSecurityModal({ type: 'unlock', password: '' })}
                />
            )}

            <EventActionCard 
                icon="fa-layer-group" 
                title="Adicionar Lote" 
                desc={`Lote Atual: ${config.currentBatch}`}
                highlightDesc
                onClick={() => {
                    setNewBatchNumber(config.currentBatch + 1);
                    setBatchModal('create');
                }}
            />
            
            {config.currentBatch > 1 && (
                <EventActionCard 
                    icon="fa-rotate-left" 
                    title="Reverter Lote" 
                    desc={`Apagar Lote ${config.currentBatch}`}
                    variant="danger"
                    onClick={() => setBatchModal('delete')}
                />
            )}

            <EventActionCard 
                icon="fa-circle-exclamation" 
                title="Encerrar Evento" 
                desc=""
                variant="danger"
                onClick={() => setSecurityModal({ type: 'end', password: '' })}
            />
            </div>
            
            <div className="p-6 rounded-3xl bg-background border border-border-light text-center">
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">
                Ações executadas nesta aba são irreversíveis e impactam todo o sistema.
            </p>
            </div>

            {/* MODAL CRIAR LOTE */}
            <Modal isOpen={batchModal === 'create'} onClose={() => setBatchModal(null)} title="Novo Lote de Pedidos">
                <div className="space-y-6 text-center">
                    <div className="p-6 bg-primary/5 rounded-2xl border border-primary/20">
                        <p className="text-sm text-text-secondary font-bold uppercase tracking-widest mb-2">Lote Atual</p>
                        <p className="text-3xl font-black text-text-primary mb-6">{config.currentBatch}</p>
                        <i className="fas fa-arrow-down text-primary mb-6 animate-bounce"></i>
                        <p className="text-sm text-text-secondary font-bold uppercase tracking-widest mb-2">Novo Lote</p>
                        <p className="text-4xl font-black text-primary">{newBatchNumber}</p>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed px-4">
                        Ao confirmar, o sistema passará a registrar pedidos no <strong>Lote {newBatchNumber}</strong>. 
                        Pedidos antigos serão preservados no Lote {config.currentBatch}.
                        As listagens de pedidos e confirmações serão visualmente limpas para o novo ciclo.
                    </p>
                    <div className="flex gap-4">
                        <Button variant="outline" className="flex-1 h-14" onClick={() => setBatchModal(null)}>CANCELAR</Button>
                        <Button className="flex-1 h-14" onClick={handleCreateBatch} disabled={isLoadingBatch}>
                            {isLoadingBatch ? "CRIANDO..." : "CONFIRMAR NOVO LOTE"}
                        </Button>
                    </div>
                </div>
            </Modal>

             {/* MODAL DELETAR LOTE */}
             <Modal isOpen={batchModal === 'delete'} onClose={() => setBatchModal(null)} title="Reverter Lote">
                <div className="space-y-6 text-center">
                    <div className="p-6 bg-red-500/5 rounded-2xl border border-red-500/20">
                        <p className="text-sm text-red-500 font-bold uppercase tracking-widest mb-2">Lote a Excluir</p>
                        <p className="text-4xl font-black text-red-600">{config.currentBatch}</p>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed px-4 font-bold">
                        ⚠️ ATENÇÃO: Todos os pedidos e confirmações criados no Lote {config.currentBatch} serão APAGADOS PERMANENTEMENTE.
                        O sistema voltará a operar no Lote {config.currentBatch - 1}.
                    </p>
                    <div className="flex gap-4">
                        <Button variant="outline" className="flex-1 h-14" onClick={() => setBatchModal(null)}>CANCELAR</Button>
                        <Button variant="danger" className="flex-1 h-14" onClick={handleDeleteBatch} disabled={isLoadingBatch}>
                            {isLoadingBatch ? "REVERTENDO..." : "EXCLUIR LOTE"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const EventActionCard: React.FC<{ icon: string, title: string, desc: string, onClick: () => void, variant?: 'danger' | 'success' | 'default', loading?: boolean, highlightDesc?: boolean }> = ({ icon, title, desc, onClick, variant = 'default', loading, highlightDesc }) => (
  <button 
    onClick={onClick}
    disabled={loading}
    className={`card bg-primary-light border-primary/30 p-8 text-left group relative overflow-hidden flex flex-row items-center gap-6 w-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${variant === 'danger' ? 'hover:border-red-500/50' : variant === 'success' ? 'hover:border-green-500/50' : 'hover:border-primary/50'}`}
  >
    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-2xl transition-all duration-500 shrink-0 group-hover:scale-110 group-hover:rotate-3 ${variant === 'danger' ? 'bg-red-500/10 text-red-500' : variant === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-primary-light text-primary'}`}>
      <i className={`fas ${loading ? 'fa-circle-notch fa-spin' : icon}`}></i>
    </div>
    <div className="flex-1">
      <h3 className={`text-xl font-black uppercase tracking-tight ${variant === 'danger' ? 'text-red-500' : variant === 'success' ? 'text-green-500' : 'text-text-primary group-hover:text-primary transition-colors'}`}>{title}</h3>
      {desc && (
        <p className={`font-black uppercase tracking-widest mt-1 leading-relaxed transition-all ${highlightDesc ? 'text-2xl text-primary' : 'text-[11px] text-text-secondary opacity-70 group-hover:opacity-100'}`}>
          {desc}
        </p>
      )}
    </div>
    <div className={`text-xs opacity-0 group-hover:opacity-40 transition-all transform translate-x-4 group-hover:translate-x-0 ${variant === 'danger' ? 'text-red-500' : variant === 'success' ? 'text-green-500' : 'text-primary'}`}>
      <i className="fas fa-chevron-right"></i>
    </div>
  </button>
);
