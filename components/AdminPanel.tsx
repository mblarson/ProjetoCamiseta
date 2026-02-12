import React, { useState, useEffect, useCallback } from 'react';
import { AdminTab, Stats, Order, PaymentHistory } from '../types';
import { Card, Button, Input, CurrencyInput, Modal } from './UI';
import { AdminMenu } from './AdminMenu';
import { SizeMatrix } from './SizeMatrix';
import { analyzeSales } from '../services/aiService';
import { 
  getAllOrders, deleteOrder, getGlobalConfig, updateGlobalConfig, 
  endEvent, getStats, recordPayment, cancelLastPayment, getOrderById, getPaymentHistoryForOrder, 
  getPaginatedOrders, searchOrders, syncAllStats, fetchFullBackup
} from '../services/firebase';
import { generateOrderPDF } from '../services/pdfService';
import { DashboardTab } from './admin/DashboardTab';
import { PaymentsTab } from './admin/PaymentsTab';
import { OrdersTab } from './admin/OrdersTab';
import { EventTab } from './admin/EventTab';
import { StatisticsTab } from './admin/StatisticsTab';

interface AdminPanelProps {
  stats: Stats | null;
  onEditOrder: (order: Order) => void;
  onShowSizeMatrix: () => void;
}

const getTabDescription = (tab: AdminTab) => {
    switch (tab) {
        case AdminTab.Dashboard: return "Métricas e visão consolidada.";
        case AdminTab.Orders: return "Gestão de pedidos individuais.";
        case AdminTab.Payments: return "Controle de recebimentos.";
        case AdminTab.Statistics: return "Análise de débitos e performance.";
        case AdminTab.Event: return "Configurações críticas do sistema.";
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
  
  const [config, setConfig] = useState<{ pedidosAbertos: boolean, valorCamiseta: number, currentBatch: number }>({ pedidosAbertos: true, valorCamiseta: 30.00, currentBatch: 1 });
  const [isProcessingConfig, setIsProcessingConfig] = useState(false);
  const [securityModal, setSecurityModal] = useState<{ type: 'lock' | 'unlock' | 'end' | 'price' | null, password: string, newValue?: any }>({ type: null, password: '' });

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  
  const [lastVisibleOrder, setLastVisibleOrder] = useState<any | null>(null);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // NOVO: Controle de lote centralizado no AdminPanel para garantir independência de paginação
  const [ordersLoteFilter, setOrdersLoteFilter] = useState<number | 'Todos'>(1);

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

  const loadInitialOrdersPage = useCallback(async (lote?: number) => {
    setIsLoadingOrders(true);
    const { orders: newOrders, lastVisible } = await getPaginatedOrders(undefined, lote);
    setOrders(newOrders);
    setLastVisibleOrder(lastVisible);
    setHasMoreOrders(lastVisible !== null);
    setIsLoadingOrders(false);
  }, []);

  const loadConfig = useCallback(async () => {
    const c = await getGlobalConfig();
    setConfig(c);
    // REGRA OBRIGATÓRIA: Força a abertura no lote atual definido no banco
    setOrdersLoteFilter(c.currentBatch);
  }, []);

  useEffect(() => {
    const loadDataForTab = async () => {
      if (tab === AdminTab.Dashboard) {
        await syncAllStats();
        const s = await getStats();
        setCurrentStats(s);
      } else if (tab === AdminTab.Orders) {
        if (debouncedSearchText) {
          setIsLoadingOrders(true);
          const results = await searchOrders(debouncedSearchText);
          setOrders(results);
          setHasMoreOrders(false);
          setIsLoadingOrders(false);
        } else {
          // Quando não há busca, usamos a paginação por lote
          const currentLote = ordersLoteFilter === 'Todos' ? undefined : (ordersLoteFilter as number);
          await loadInitialOrdersPage(currentLote);
        }
      } else if (tab === AdminTab.Payments || tab === AdminTab.Statistics) {
        setIsLoadingOrders(true);
        if (debouncedSearchText) {
          const results = await searchOrders(debouncedSearchText);
          setOrders(results);
        } else {
          await loadAllOrders();
        }
        setIsLoadingOrders(false);
      } else if (tab === AdminTab.Event) {
        await loadConfig();
      }
    };
    loadDataForTab();
  }, [tab, debouncedSearchText, ordersLoteFilter, loadInitialOrdersPage, loadConfig]);

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

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const loadAllOrders = async () => {
    const data = await getAllOrders();
    setOrders(data);
  };
  
  const loadMoreOrders = async () => {
    if (!lastVisibleOrder || !hasMoreOrders) return;
    setIsLoadingMore(true);
    const currentLote = ordersLoteFilter === 'Todos' ? undefined : (ordersLoteFilter as number);
    const { orders: newOrders, lastVisible } = await getPaginatedOrders(lastVisibleOrder, currentLote);
    setOrders(prev => [...prev, ...newOrders]);
    setLastVisibleOrder(lastVisible);
    setHasMoreOrders(lastVisible !== null);
    setIsLoadingMore(false);
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
        const currentLote = ordersLoteFilter === 'Todos' ? undefined : (ordersLoteFilter as number);
        await loadInitialOrdersPage(currentLote);
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

  const downloadJSONBackup = (data: any) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BACKUP_UMADEMATS_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
      try {
        alert("Iniciando backup completo antes da exclusão...");
        const backupData = await fetchFullBackup();
        downloadJSONBackup(backupData);
        
        await new Promise(r => setTimeout(r, 2000));
        
        if (confirm("Backup baixado com sucesso! Deseja prosseguir com a exclusão TOTAL dos dados do banco?")) {
           success = await endEvent();
           if (success) {
             alert("Evento encerrado com sucesso. Todos os dados foram resetados.");
             window.location.reload();
           }
        } else {
          alert("Exclusão cancelada. Seus dados continuam no banco, e você já possui o backup salvo.");
        }
      } catch (e) {
        alert("Falha crítica ao gerar backup. A exclusão foi abortada por segurança.");
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

  return (
    <div className="flex flex-col gap-4 sm:gap-6 animate-in slide-in-from-right-4 duration-500 w-full max-w-full overflow-x-hidden px-1 sm:px-0">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 sm:gap-6 border-b border-border-light pb-4 sm:pb-6">
        <div className="flex flex-col gap-0.5 sm:gap-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 sm:gap-3">
              <h2 className="font-black text-xl sm:text-2xl md:text-3xl text-text-primary tracking-tight capitalize leading-none">{tab}</h2>
              <button 
                onClick={handleRefreshMetrics}
                disabled={isProcessingConfig}
                className="flex items-center gap-1 text-primary hover:text-text-primary transition-colors text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
              >
                <i className={`fas fa-sync-alt ${isProcessingConfig ? 'fa-spin' : ''}`}></i>
                <span className="hidden xs:inline">Sincronizar</span>
              </button>
            </div>
            <p className="text-[9px] sm:text-[10px] text-text-secondary font-bold uppercase tracking-widest leading-tight">
                {getTabDescription(tab)}
            </p>
        </div>
        <div className="w-full md:w-auto">
          <AdminMenu activeTab={tab} onSelectTab={handleTabSelect} />
        </div>
      </div>

      <div className="w-full max-w-full overflow-x-hidden">
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
            onEditOrder={onEditOrder}
            setOrderToDelete={setOrderToDelete}
            loadMoreOrders={loadMoreOrders}
            hasMoreOrders={hasMoreOrders}
            isLoadingMore={isLoadingMore}
            loteFilter={ordersLoteFilter}
            setLoteFilter={setOrdersLoteFilter}
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
      </div>

      <Modal 
        isOpen={!!registerPaymentOrder} 
        onClose={() => setRegisterPaymentOrder(null)} 
        title="Liquidar Pagamento"
      >
        <div className="space-y-6 sm:space-y-8 w-full max-w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <CurrencyInput 
              label="VALOR PAGO"
              value={paymentAmount} 
              onChange={setPaymentAmount}
              placeholder="R$ 0,00"
              className="text-xl sm:text-2xl font-black h-14 sm:h-16"
            />
            
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <label className="text-[10px] sm:text-[11px] uppercase font-black tracking-widest text-primary/70">DATA DO RECEBIMENTO</label>
              <input 
                type="date" 
                value={paymentDate} 
                onChange={e => setPaymentDate(e.target.value)} 
                className="w-full bg-surface border-2 border-border-light rounded-xl h-14 sm:h-16 px-3 sm:px-4 text-text-primary text-base sm:text-lg font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-center"
              />
            </div>
          </div>

          <Button 
            className="w-full h-14 sm:h-16 text-xs sm:text-sm" 
            onClick={handleRegisterPayment} 
            disabled={isProcessingPayment || !paymentAmount}
          >
            {isProcessingPayment ? "PROCESSANDO..." : "CONFIRMAR PAGAMENTO"}
          </Button>

          <div className="pt-4 sm:pt-6 space-y-4 sm:space-y-5">
            <h3 className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-text-secondary text-center">Histórico de Lançamentos</h3>
            
            <div className="overflow-hidden rounded-xl border-2 border-border-light/50 w-full">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-border-light/50">
                    <th className="py-3 sm:py-4 text-center w-1/2 font-black text-[9px] sm:text-[10px] uppercase tracking-widest text-text-secondary">DATA</th>
                    <th className="py-3 sm:py-4 text-center w-1/2 border-l-2 border-border-light/50 font-black text-[9px] sm:text-[10px] uppercase tracking-widest text-text-secondary">VALOR</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-border-light/30 text-center">
                  {isLoadingHistory ? (
                    <tr><td colSpan={2} className="py-8 text-text-secondary/60 italic text-sm uppercase tracking-widest">Sincronizando...</td></tr>
                  ) : (orderPaymentHistory.length === 0) ? (
                    <tr>
                      <td colSpan={2} className="py-8 text-text-secondary/60 italic text-[11px] uppercase tracking-widest">Sem lançamentos</td>
                    </tr>
                  ) : (
                    orderPaymentHistory.slice().reverse().map((h: PaymentHistory) => (
                      <tr key={h.liquidacaoId} className="text-text-primary hover:bg-primary-light/30 transition-colors font-bold">
                        <td className="py-4 text-text-secondary text-xs sm:text-sm">{h.data}</td>
                        <td className="py-4 border-l-2 border-border-light/30 text-xs sm:text-sm">{h.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
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
                  className="px-6 py-2.5 sm:px-8 h-10 sm:h-12 rounded-full text-[9px] sm:text-[10px] flex items-center gap-2"
                >
                  {isProcessingPayment ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : (
                    <>
                      <i className="fas fa-undo"></i>
                      <span>ESTORNAR ÚLTIMA</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal isOpen={isPriceModalOpen} onClose={() => setIsPriceModalOpen(false)} title="Alterar Valor">
        <div className="space-y-6 w-full max-w-full">
          <div className="p-5 sm:p-8 bg-surface border-2 border-border-light rounded-xl sm:rounded-2xl">
            <CurrencyInput 
              label="NOVO VALOR UNITÁRIO"
              value={newPrice}
              onChange={setNewPrice}
              placeholder="R$ 0,00"
              className="text-center text-2xl sm:text-3xl font-black h-16 sm:h-20"
              autoFocus
            />
          </div>
          <div className="flex gap-3 sm:gap-4">
            <Button variant="outline" className="flex-1 h-14 sm:h-16" onClick={() => setIsPriceModalOpen(false)}>CANCELAR</Button>
            <Button 
              className="flex-1 h-14 sm:h-16"
              onClick={() => {
                const priceValue = parseCurrencyToNumber(newPrice);
                if (newPrice && priceValue > 0) {
                  setIsPriceModalOpen(false);
                  setSecurityModal({ type: 'price', password: '', newValue: newPrice });
                } else {
                  alert("Valor inválido.");
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
        <div className="space-y-6 w-full max-w-full overflow-hidden">
          <div className="p-5 sm:p-10 bg-surface border-2 border-primary/20 rounded-xl sm:rounded-2xl text-center flex flex-col gap-6">
            <p className="text-xs sm:text-sm text-text-secondary font-bold uppercase tracking-widest leading-relaxed">Confirme com a senha mestre para prosseguir:</p>
            <Input 
              type="text" 
              placeholder="DIGITE A SENHA" 
              autoFocus 
              value={securityModal.password} 
              onChange={e => setSecurityModal({...securityModal, password: e.target.value.toUpperCase()})} 
              className="text-center tracking-[0.4em] sm:tracking-[0.6em] text-xl sm:text-2xl h-14 sm:h-16 font-black uppercase" 
            />
          </div>
          <div className="flex gap-3 sm:gap-4">
            <Button variant="outline" className="flex-1 h-14 sm:h-16 text-xs sm:text-sm" onClick={() => setSecurityModal({ type: null, password: '' })}>CANCELAR</Button>
            <Button className="flex-1 h-14 sm:h-16 text-xs sm:text-sm" onClick={handleSecurityAction} disabled={isProcessingConfig || !securityModal.password}>CONFIRMAR</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!orderToDelete} onClose={() => setOrderToDelete(null)} title="Excluir Registro">
        <div className="space-y-6 w-full max-w-full">
          <div className="text-center p-6 sm:p-10 bg-red-500/5 border-2 border-red-500/20 rounded-xl sm:rounded-2xl">
            <p className="text-sm sm:text-base text-text-secondary font-bold uppercase tracking-widest mb-4 leading-relaxed">Apagar permanentemente o pedido</p>
            <p className="text-3xl sm:text-4xl font-black text-text-primary tracking-widest mb-3 sm:mb-4">#{orderToDelete?.numPedido}</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/30">
               <i className="fas fa-exclamation-triangle"></i> Ação Irreversível
            </div>
          </div>
          <div className="flex gap-3 sm:gap-4">
            <Button variant="outline" className="flex-1 h-14 sm:h-16" onClick={() => setOrderToDelete(null)}>CANCELAR</Button>
            <Button variant="danger" className="flex-1 h-14 sm:h-16" onClick={handleDelete} disabled={isDeleting}>EXCLUIR AGORA</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};