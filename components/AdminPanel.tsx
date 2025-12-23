
import React, { useState, useEffect, useMemo } from 'react';
import { AdminTab, Stats, Order, PaymentHistory, Confirmation } from '../types';
import { Card, Button, Input, CurrencyInput, Modal } from './UI';
import { AdminMenu } from './AdminMenu';
import { SizeMatrix } from './SizeMatrix';
import { analyzeSales } from '../services/aiService';
import { 
  getAllOrders, deleteOrder, getGlobalConfig, updateGlobalConfig, 
  endEvent, getStats, recordPayment, cancelLastPayment, getOrderById, getPaymentHistoryForOrder, 
  syncConfirmationsFromOrders, getConfirmations, updateConfirmationStatus, getPaginatedOrders,
  searchOrders, searchConfirmations, syncAllStats
} from '../services/firebase';
import { generateOrderPDF } from '../services/pdfService';
import { DashboardTab } from './admin/DashboardTab';
import { PaymentsTab } from './admin/PaymentsTab';
import { OrdersTab } from './admin/OrdersTab';
import { ConfirmationTab } from './admin/ConfirmationTab';
import { EventTab } from './admin/EventTab';
import { StatisticsTab } from './admin/StatisticsTab';

interface AdminPanelProps {
  stats: Stats | null;
  onEditOrder: (order: Order) => void;
  onShowSizeMatrix: () => void;
}

const getTabDescription = (tab: AdminTab) => {
    switch (tab) {
        case AdminTab.Dashboard: return "Visão geral e métricas do evento.";
        case AdminTab.Orders: return "Gerenciar todos os pedidos individuais.";
        case AdminTab.Payments: return "Controlar recebimentos por setor ou cidade.";
        case AdminTab.Confirmation: return "Controlar confirmações de presença via WhatsApp.";
        case AdminTab.Statistics: return "Análise de performance e débitos por localidade.";
        case AdminTab.Event: return "Configurações gerais e ações críticas.";
        default: return "";
    }
};

const parseCurrencyToNumber = (value: string): number => {
  if (!value) return 0;
  const cleanedValue = value.replace(/[^\d]/g, "");
  return Number(cleanedValue) / 100;
};

const formatNumberToCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ stats: initialStats, onEditOrder, onShowSizeMatrix }) => {
  const [tab, setTab] = useState<AdminTab>(AdminTab.Dashboard);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [currentStats, setCurrentStats] = useState<Stats | null>(initialStats);
  
  const [config, setConfig] = useState<{ pedidosAbertos: boolean, valorCamiseta: number }>({ pedidosAbertos: true, valorCamiseta: 30.00 });
  const [isProcessingConfig, setIsProcessingConfig] = useState(false);
  const [securityModal, setSecurityModal] = useState<{ type: 'lock' | 'unlock' | 'end' | 'price' | null, password: string, newValue?: any }>({ type: null, password: '' });

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  
  const [lastVisibleOrder, setLastVisibleOrder] = useState<any | null>(null);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [isLoadingConfirmations, setIsLoadingConfirmations] = useState(false);
  const [isSyncingConfirmations, setIsSyncingConfirmations] = useState(false);
  const [editingConfirmation, setEditingConfirmation] = useState<Confirmation | null>(null);
  const [isUpdatingConfirmation, setIsUpdatingConfirmation] = useState(false);

  const [registerPaymentOrder, setRegisterPaymentOrder] = useState<Order | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [orderPaymentHistory, setOrderPaymentHistory] = useState<PaymentHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchText(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    const loadDataForTab = async () => {
      setOrders([]);
      setConfirmations([]);

      if (tab === AdminTab.Dashboard) {
        const s = await getStats();
        setCurrentStats(s);
      } else if (tab === AdminTab.Orders) {
        setIsLoadingOrders(true);
        if (debouncedSearchText) {
          const results = await searchOrders(debouncedSearchText);
          setOrders(results);
          setHasMoreOrders(false);
        } else {
          loadInitialOrdersPage();
        }
        setIsLoadingOrders(false);
      } else if (tab === AdminTab.Payments || tab === AdminTab.Statistics) {
        setIsLoadingOrders(true);
        if (debouncedSearchText) {
          const results = await searchOrders(debouncedSearchText);
          setOrders(results);
        } else {
          loadAllOrders();
        }
        setIsLoadingOrders(false);
      } else if (tab === AdminTab.Event) {
        loadConfig();
      } else if (tab === AdminTab.Confirmation) {
        setIsLoadingConfirmations(true);
        if (debouncedSearchText) {
          const results = await searchConfirmations(debouncedSearchText);
          setConfirmations(results);
        } else {
          loadConfirmations();
        }
        setIsLoadingConfirmations(false);
      }
    };
    loadDataForTab();
  }, [tab, debouncedSearchText]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (registerPaymentOrder) {
        setIsLoadingHistory(true);
        const history = await getPaymentHistoryForOrder(registerPaymentOrder);
        setOrderPaymentHistory(history);
        setIsLoadingHistory(false);
      } else {
        setOrderPaymentHistory([]);
      }
    };
    fetchHistory();
  }, [registerPaymentOrder]);

  const loadConfig = async () => {
    const c = await getGlobalConfig();
    setConfig(c);
  };

  const loadAllOrders = async () => {
    const data = await getAllOrders();
    setOrders(data);
  };
  
  const loadInitialOrdersPage = async () => {
    setOrders([]);
    const { orders: newOrders, lastVisible } = await getPaginatedOrders();
    setOrders(newOrders);
    setLastVisibleOrder(lastVisible);
    setHasMoreOrders(lastVisible !== null);
  };

  const loadMoreOrders = async () => {
    if (!lastVisibleOrder || !hasMoreOrders) return;
    setIsLoadingMore(true);
    const { orders: newOrders, lastVisible } = await getPaginatedOrders(lastVisibleOrder);
    setOrders(prev => [...prev, ...newOrders]);
    setLastVisibleOrder(lastVisible);
    setHasMoreOrders(lastVisible !== null);
    setIsLoadingMore(false);
  };

  const loadConfirmations = async () => {
    const data = await getConfirmations();
    setConfirmations(data);
  };

  const handleSyncConfirmations = async () => {
    setIsSyncingConfirmations(true);
    await syncConfirmationsFromOrders();
    await loadConfirmations();
    setIsSyncingConfirmations(false);
  };

  const handleRefreshMetrics = async () => {
    setIsProcessingConfig(true);
    await syncAllStats(); 
    const s = await getStats();
    setCurrentStats(s);
    
    const currentSearch = debouncedSearchText;
    if (tab === AdminTab.Payments || tab === AdminTab.Statistics) {
      const data = currentSearch ? await searchOrders(currentSearch) : await getAllOrders();
      setOrders(data);
    }
    if (tab === AdminTab.Orders) {
      if (currentSearch) {
        const data = await searchOrders(currentSearch);
        setOrders(data);
      } else {
        await loadInitialOrdersPage();
      }
    }
    setTimeout(() => setIsProcessingConfig(false), 500);
  };

  const handleAiAction = async () => {
    if (!currentStats) return;
    setIsAnalysing(true);
    setAiAnalysis(await analyzeSales(currentStats));
    setIsAnalysing(false);
  };
  
  const handleTabSelect = (selectedTab: AdminTab) => {
    setTab(selectedTab);
    setSearchText('');
  };

  const handleSecurityAction = async () => {
    if (!securityModal.password) {
      alert("A senha é necessária para verificação.");
      return;
    }
    
    setIsProcessingConfig(true);
    let success = false;

    if (securityModal.type === 'lock') {
      success = await updateGlobalConfig({ pedidosAbertos: false });
      if (success) setConfig(prev => ({ ...prev, pedidosAbertos: false }));
    } else if (securityModal.type === 'unlock') {
      success = await updateGlobalConfig({ pedidosAbertos: true });
      if (success) setConfig(prev => ({ ...prev, pedidosAbertos: true }));
    } else if (securityModal.type === 'price') {
      const priceValue = parseCurrencyToNumber(securityModal.newValue);
      alert("Atualizando valor e recalculando todos os totais. Isso pode levar um momento.");
      success = await updateGlobalConfig({ valorCamiseta: priceValue });
      if (success) {
        setConfig(prev => ({ ...prev, valorCamiseta: priceValue }));
        await handleRefreshMetrics();
        alert("Valores e totais de todos os pedidos foram atualizados com sucesso!");
      } else {
        alert("Falha ao atualizar os valores.");
      }
    } else if (securityModal.type === 'end') {
      success = await endEvent();
      if (success) {
        alert("Evento encerrado com sucesso. Todos os dados foram resetados.");
        window.location.reload();
      }
    }

    setIsProcessingConfig(false);
    setSecurityModal({ type: null, password: '' });
  };

  const handleDelete = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    const success = await deleteOrder(orderToDelete);
    if (success) {
      setOrders(prev => prev.filter(o => o.docId !== orderToDelete.docId));
      setOrderToDelete(null);
      handleRefreshMetrics();
    } else {
      alert("Erro ao excluir pedido.");
    }
    setIsDeleting(false);
  };

  const handleRegisterPayment = async () => {
    if (!registerPaymentOrder || !paymentAmount) return;
    const amount = parseCurrencyToNumber(paymentAmount);
    
    if (amount <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    setIsProcessingPayment(true);
    const success = await recordPayment(registerPaymentOrder.docId, amount, paymentDate);
    
    if (success) {
      const updatedOrderFromServer = await getOrderById(registerPaymentOrder.docId);
      if (updatedOrderFromServer) setRegisterPaymentOrder(updatedOrderFromServer); 
      setPaymentAmount('');
      handleRefreshMetrics();
      alert("Pagamento registrado com sucesso!");
    } else {
      alert("Erro ao processar pagamento.");
    }
    setIsProcessingPayment(false);
  };

  const handleCancelLastPayment = async (orderId: string) => {
    if (!confirm("Deseja realmente cancelar a última liquidação deste pedido?")) return;
    setIsProcessingPayment(true);
    try {
      const success = await cancelLastPayment(orderId);
      if (success) {
        alert("Última liquidação cancelada com sucesso!");
        const updatedOrderFromServer = await getOrderById(orderId);
        if (updatedOrderFromServer) setRegisterPaymentOrder(updatedOrderFromServer); 
        handleRefreshMetrics();
      } else {
        alert("Erro ao cancelar liquidação.");
      }
    } catch (error) {
        alert("Ocorreu um erro crítico ao cancelar a liquidação.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleUpdateConfirmationStatus = async (status: 'none' | 'confirmed' | 'pending') => {
    if (!editingConfirmation) return;
    setIsUpdatingConfirmation(true);
    const success = await updateConfirmationStatus(editingConfirmation.docId, status);
    if (success) {
        const newTimestamp = new Date().toISOString();
        setConfirmations(prev => prev.map(c => 
            c.docId === editingConfirmation.docId 
            ? { ...c, status, lastUpdated: newTimestamp } 
            : c
        ));
        setEditingConfirmation(null);
    } else {
        alert("Falha ao atualizar o status.");
    }
    setIsUpdatingConfirmation(false);
};

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 border-b border-border-light pb-6">
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="font-black text-2xl md:text-3xl text-text-primary tracking-tight capitalize leading-none">{tab}</h2>
              <button 
                onClick={handleRefreshMetrics}
                disabled={isProcessingConfig}
                className="flex items-center gap-1.5 text-primary hover:text-text-primary transition-colors text-[9px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
              >
                <i className={`fas fa-sync-alt ${isProcessingConfig ? 'fa-spin' : ''}`}></i>
                <span className="hidden sm:inline">SINCRONIZAR</span>
                <span className="sm:hidden">SYNC</span>
              </button>
            </div>
            <p className="text-[9px] md:text-[10px] text-text-secondary font-bold uppercase tracking-widest">
                {getTabDescription(tab)}
            </p>
        </div>
        <AdminMenu activeTab={tab} onSelectTab={handleTabSelect} />
      </div>

      {tab === AdminTab.Dashboard && (
        <DashboardTab 
          handleAiAction={handleAiAction}
          isAnalysing={isAnalysing}
          onShowSizeMatrix={onShowSizeMatrix}
          aiAnalysis={aiAnalysis}
          currentStats={currentStats}
        />
      )}
      
      {tab === AdminTab.Payments && (
        <PaymentsTab 
          searchText={searchText}
          setSearchText={setSearchText}
          isLoadingOrders={isLoadingOrders}
          orders={orders}
          setRegisterPaymentOrder={setRegisterPaymentOrder}
          setPaymentAmount={setPaymentAmount}
        />
      )}
      
      {tab === AdminTab.Orders && (
        <OrdersTab 
          searchText={searchText}
          setSearchText={setSearchText}
          isLoadingOrders={isLoadingOrders}
          orders={orders}
          setOrderToDelete={setOrderToDelete}
          loadMoreOrders={loadMoreOrders}
          hasMoreOrders={hasMoreOrders}
          isLoadingMore={isLoadingMore}
        />
      )}
      
      {tab === AdminTab.Confirmation && (
        <ConfirmationTab 
          searchText={searchText}
          setSearchText={setSearchText}
          confirmations={confirmations}
          isLoading={isLoadingConfirmations}
          onEdit={setEditingConfirmation}
          onSync={handleSyncConfirmations}
          isSyncing={isSyncingConfirmations}
        />
      )}

      {tab === AdminTab.Statistics && (
        <StatisticsTab
          orders={orders}
          isLoading={isLoadingOrders}
        />
      )}

      {tab === AdminTab.Event && (
        <EventTab 
          config={config}
          setNewPrice={setNewPrice}
          setIsPriceModalOpen={setIsPriceModalOpen}
          formatNumberToCurrency={formatNumberToCurrency}
          setSecurityModal={setSecurityModal}
        />
      )}

      <Modal 
        isOpen={!!registerPaymentOrder} 
        onClose={() => setRegisterPaymentOrder(null)} 
        title="Liquidar Pagamento"
      >
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CurrencyInput 
              label="VALOR PAGO"
              value={paymentAmount} 
              onChange={setPaymentAmount}
              placeholder="R$ 0,00"
              className="text-2xl font-black h-14"
            />
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-primary/70">DATA DO RECEBIMENTO</label>
              <input 
                type="date" 
                value={paymentDate} 
                onChange={e => setPaymentDate(e.target.value)} 
                className="w-full bg-surface border border-border-light rounded-xl h-14 px-4 text-text-primary text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-center"
              />
            </div>
          </div>

          <Button 
            className="w-full h-14 text-sm" 
            onClick={handleRegisterPayment} 
            disabled={isProcessingPayment || !paymentAmount}
          >
            {isProcessingPayment ? "PROCESSANDO..." : "CONFIRMAR PAGAMENTO"}
          </Button>

          <div className="pt-4 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-text-secondary text-center">Histórico de Pagamentos</h3>
            
            <div className="overflow-hidden rounded-xl border border-border-light/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-border-light/50">
                    <th className="py-3 text-center w-1/2 font-black text-[9px] uppercase tracking-widest text-text-secondary">DATA</th>
                    <th className="py-3 text-center w-1/2 border-l border-border-light/50 font-black text-[9px] uppercase tracking-widest text-text-secondary">VALOR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light/30 text-center">
                  {isLoadingHistory ? (
                    <tr><td colSpan={2} className="py-8 text-text-secondary/60 italic text-xs">Sincronizando...</td></tr>
                  ) : (orderPaymentHistory.length === 0) ? (
                    <tr>
                      <td colSpan={2} className="py-8 text-text-secondary/60 italic text-xs uppercase tracking-widest">Sem lançamentos</td>
                    </tr>
                  ) : (
                    orderPaymentHistory.slice().reverse().map((h: PaymentHistory) => (
                      <tr key={h.liquidacaoId} className="text-text-primary hover:bg-primary-light/30 transition-colors font-bold">
                        <td className="py-3.5 text-text-secondary text-xs">{h.data}</td>
                        <td className="py-3.5 border-l border-border-light/30 text-xs">{h.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!isLoadingHistory && orderPaymentHistory.length > 0 && (
              <div className="flex justify-center pt-2">
                <Button 
                  onClick={() => handleCancelLastPayment(registerPaymentOrder!.docId)}
                  disabled={isProcessingPayment}
                  variant="danger"
                  className="px-6 py-2 rounded-full text-[9px] flex items-center gap-2 h-10"
                >
                  {isProcessingPayment ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      <span>Cancelando...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-undo"></i>
                      <span>CANCELAR ÚLTIMA</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={!!editingConfirmation} 
        onClose={() => setEditingConfirmation(null)} 
        title={`Alterar Status: ${editingConfirmation?.docId}`}
      >
        <div className="space-y-6">
            <p className="text-center text-sm text-text-secondary font-bold uppercase tracking-wider">Selecione o novo status de confirmação.</p>
            <div className="grid grid-cols-1 gap-4 pt-4">
                <Button 
                    onClick={() => handleUpdateConfirmationStatus('confirmed')} 
                    disabled={isUpdatingConfirmation}
                    className="h-14 bg-green-500 hover:bg-green-600 text-white"
                >
                    <i className="fas fa-check-circle"></i> Confirmado
                </Button>
                <Button 
                    onClick={() => handleUpdateConfirmationStatus('pending')} 
                    disabled={isUpdatingConfirmation}
                    className="h-14 bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                    <i className="fas fa-clock"></i> Pendente
                </Button>
                <Button 
                    onClick={() => handleUpdateConfirmationStatus('none')} 
                    disabled={isUpdatingConfirmation}
                    variant="outline"
                    className="h-14"
                >
                    <i className="fas fa-question-circle"></i> Não Aplicável
                </Button>
            </div>
            {isUpdatingConfirmation && (
                <p className="text-center text-primary font-black text-xs animate-pulse uppercase tracking-wider">Atualizando...</p>
            )}
        </div>
      </Modal>

      <Modal isOpen={isPriceModalOpen} onClose={() => setIsPriceModalOpen(false)} title="Alterar Valor">
        <div className="space-y-6">
          <div className="p-6 bg-surface border border-border-light rounded-2xl">
            <CurrencyInput 
              label="NOVO VALOR UNITÁRIO"
              value={newPrice}
              onChange={setNewPrice}
              placeholder="R$ 0,00"
              className="text-center text-2xl font-black h-14"
              autoFocus
            />
          </div>
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1 h-14" onClick={() => setIsPriceModalOpen(false)}>CANCELAR</Button>
            <Button 
              className="flex-1 h-14"
              onClick={() => {
                const priceValue = parseCurrencyToNumber(newPrice);
                if (newPrice && priceValue > 0) {
                  setIsPriceModalOpen(false);
                  setSecurityModal({ type: 'price', password: '', newValue: newPrice });
                } else {
                  alert("Por favor, insira um valor numérico válido e maior que zero.");
                }
              }}
              disabled={!newPrice || parseCurrencyToNumber(newPrice) <= 0}
            >
              SALVAR
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!securityModal.type} onClose={() => setSecurityModal({ type: null, password: '' })} title="Verificação Mestre">
        <div className="space-y-6">
          <div className="p-8 bg-surface border border-primary/20 rounded-2xl text-center">
            <p className="text-sm text-text-secondary font-bold uppercase tracking-widest mb-6">Informe a senha mestre para confirmar:</p>
            <Input type="text" placeholder="SENHA" autoFocus value={securityModal.password} onChange={e => setSecurityModal({...securityModal, password: e.target.value.toUpperCase()})} className="text-center tracking-[0.5em] text-xl" />
          </div>
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1 h-14 text-sm" onClick={() => setSecurityModal({ type: null, password: '' })}>CANCELAR</Button>
            <Button className="flex-1 h-14 text-sm" onClick={handleSecurityAction} disabled={isProcessingConfig || !securityModal.password}>CONFIRMAR</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!orderToDelete} onClose={() => setOrderToDelete(null)} title="Excluir Pedido!">
        <div className="space-y-6">
          <div className="text-center p-6 bg-red-500/5 border border-red-500/20 rounded-2xl">
            <p className="text-sm text-text-secondary font-bold uppercase tracking-widest mb-2 leading-relaxed">Apagar o pedido</p>
            <p className="text-3xl font-black text-text-primary tracking-widest mb-2">#{orderToDelete?.numPedido}</p>
            <p className="text-xs text-red-500/80 font-black uppercase tracking-widest">Essa ação é permanente!</p>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1 h-14" onClick={() => setOrderToDelete(null)}>MANTER</Button>
            <Button variant="danger" className="flex-1 h-14" onClick={handleDelete} disabled={isDeleting}>EXCLUIR!</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
