import React, { useState, useEffect, useMemo } from 'react';
import { AdminTab, Stats, Order, PaymentHistory } from '../types';
import { Card, Button, Input, CurrencyInput, Modal } from './UI';
import { AdminMenu } from './AdminMenu';
import { SizeMatrix } from './SizeMatrix';
import { analyzeSales } from '../services/aiService';
import { 
  getAllOrders, deleteOrder, getGlobalConfig, updateGlobalConfig, 
  endEvent, getStats, recordPayment, cancelLastPayment, getOrderById, getPaymentHistoryForOrder 
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
        case AdminTab.Dashboard: return "Visão geral e métricas do evento.";
        case AdminTab.Orders: return "Gerenciar todos os pedidos individuais.";
        case AdminTab.Payments: return "Controlar recebimentos por setor ou cidade.";
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
    const loadDataForTab = async () => {
      if (tab === AdminTab.Dashboard) {
        const s = await getStats();
        setCurrentStats(s);
      } else if (tab === AdminTab.Orders || tab === AdminTab.Payments || tab === AdminTab.Statistics) {
        loadOrders();
      } else if (tab === AdminTab.Event) {
        loadConfig();
      }
    };
    loadDataForTab();
  }, [tab]);

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

  const loadOrders = async () => {
    setIsLoadingOrders(true);
    const data = await getAllOrders();
    setOrders(data);
    setIsLoadingOrders(false);
  };

  const handleRefreshMetrics = async () => {
    setIsProcessingConfig(true);
    const s = await getStats();
    setCurrentStats(s);
    if (tab === AdminTab.Payments || tab === AdminTab.Orders) await loadOrders();
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
    const ADMIN_PASS = "UMADEMATS50"; 
    
    if (securityModal.password !== ADMIN_PASS) {
      alert("Senha incorreta!");
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
      loadOrders();
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
        loadOrders();
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
    <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 border-b border-border-light pb-8">
        <div>
            <div className="flex items-center gap-6">
              <h2 className="text-3xl font-black text-text-primary uppercase tracking-tighter capitalize">{tab}</h2>
              {tab === AdminTab.Payments && (
                <button 
                  onClick={handleRefreshMetrics}
                  disabled={isProcessingConfig}
                  className="flex items-center gap-2 text-primary hover:text-text-primary transition-colors text-[10px] font-black uppercase tracking-widest"
                >
                  <i className={`fas fa-sync-alt ${isProcessingConfig ? 'fa-spin' : ''}`}></i>
                  Atualizar
                </button>
              )}
            </div>
            <p className="text-xs text-text-secondary font-bold uppercase tracking-widest mt-1">
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
          <div className="space-y-6">
            <CurrencyInput 
              label="VALOR PAGO"
              value={paymentAmount} 
              onChange={setPaymentAmount}
              placeholder="R$ 0,00"
              className="text-lg font-bold h-16"
            />
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">DATA DO RECEBIMENTO</label>
              <input 
                type="date" 
                value={paymentDate} 
                onChange={e => setPaymentDate(e.target.value)} 
                className="w-full bg-surface border border-border-light rounded-2xl h-16 px-6 text-text-primary text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
            </div>
          </div>

          <button 
            className="w-full h-16 rounded-full font-black tracking-[0.2em] text-[#0A192F] uppercase text-sm bg-primary hover:brightness-90 active:scale-[0.98] transition-all disabled:opacity-60" 
            onClick={handleRegisterPayment} 
            disabled={isProcessingPayment || !paymentAmount}
          >
            {isProcessingPayment ? "PROCESSANDO..." : "CONFIRMAR PAGAMENTO"}
          </button>

          <div className="pt-10 border-t border-border-light space-y-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-text-secondary text-center">HISTÓRICO DE PAGAMENTOS</h3>
            
            <div className="overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-text-secondary/70 uppercase tracking-widest font-black">
                    <th className="pb-4 text-center w-1/2">DATA</th>
                    <th className="pb-4 text-center w-1/2">VALOR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light text-center font-bold">
                  {isLoadingHistory ? (
                    <tr><td colSpan={2} className="py-12 text-text-secondary/60 italic">Carregando histórico...</td></tr>
                  ) : (orderPaymentHistory.length === 0) ? (
                    <tr>
                      <td colSpan={2} className="py-12 text-text-secondary/60 italic">Nenhum lançamento registrado</td>
                    </tr>
                  ) : (
                    orderPaymentHistory.slice().reverse().map((h: PaymentHistory) => (
                      <tr key={h.liquidacaoId} className="text-text-primary hover:bg-background transition-colors">
                        <td className="py-5 text-text-secondary">{h.data}</td>
                        <td className="py-5">{h.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!isLoadingHistory && orderPaymentHistory.length > 0 && (
              <div className="flex justify-center pt-4">
                <button 
                  onClick={() => handleCancelLastPayment(registerPaymentOrder!.docId)}
                  disabled={isProcessingPayment}
                  className="px-8 py-3 rounded-full border border-red-500 text-red-500 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-red-500/10 transition-all shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isProcessingPayment ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      <span>Cancelando...</span>
                    </>
                  ) : (
                    'CANCELAR ULTIMA LIQUIDAÇÃO'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </Modal>
      
      <Modal isOpen={isPriceModalOpen} onClose={() => setIsPriceModalOpen(false)} title="Alterar Valor da Camiseta">
        <div className="space-y-6">
          <div className="p-8 bg-surface border border-border-light rounded-3xl">
            <CurrencyInput 
              label="NOVO VALOR UNITÁRIO"
              value={newPrice}
              onChange={setNewPrice}
              placeholder="R$ 0,00"
              className="text-center text-2xl font-black h-16"
              autoFocus
            />
          </div>
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1 h-16" onClick={() => setIsPriceModalOpen(false)}>CANCELAR</Button>
            <Button 
              className="flex-1 h-16"
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
          <div className="p-8 bg-surface border border-primary/20 rounded-3xl text-center">
            <p className="text-[11px] text-text-secondary font-bold uppercase tracking-widest mb-6">Informe a senha administrativa para confirmar:</p>
            <Input type="password" placeholder="SENHA" autoFocus value={securityModal.password} onChange={e => setSecurityModal({...securityModal, password: e.target.value.toUpperCase()})} className="text-center tracking-[0.5em]" />
          </div>
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1 h-16" onClick={() => setSecurityModal({ type: null, password: '' })}>CANCELAR</Button>
            <Button className="flex-1 h-16" onClick={handleSecurityAction} disabled={isProcessingConfig || !securityModal.password}>CONFIRMAR</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!orderToDelete} onClose={() => setOrderToDelete(null)} title="Excluir Registro">
        <div className="space-y-6">
          <div className="text-center p-6 bg-red-500/5 border border-red-500/10 rounded-2xl">
            <p className="text-sm text-text-secondary font-bold uppercase tracking-widest mb-2 leading-relaxed">Deseja realmente apagar o pedido</p>
            <p className="text-lg font-black text-text-primary tracking-widest mb-2">#{orderToDelete?.numPedido}</p>
            <p className="text-xs text-red-500/80 font-bold uppercase tracking-widest">Esta ação não pode ser desfeita.</p>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1 h-14" onClick={() => setOrderToDelete(null)}>MANTER PEDIDO</Button>
            <Button variant="danger" className="flex-1 h-14" onClick={handleDelete} disabled={isDeleting}>SIM, EXCLUIR</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};