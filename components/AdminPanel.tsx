
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
  searchOrders, searchConfirmations, syncAllStats, fetchFullBackup
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
  
  const [config, setConfig] = useState({ pedidosAbertos: true, valorCamiseta: 30.00, currentBatch: 1 });
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
      if (tab === AdminTab.Dashboard) {
        setIsProcessingConfig(true);
        await syncAllStats().catch(() => {});
        const s = await getStats();
        setCurrentStats(s);
        setIsProcessingConfig(false);
      } else if (tab === AdminTab.Orders) {
        setIsLoadingOrders(true);
        if (debouncedSearchText) {
          const results = await searchOrders(debouncedSearchText);
          setOrders(results);
          setHasMoreOrders(false);
        } else {
          const { orders: newOrders, lastVisible } = await getPaginatedOrders();
          setOrders(newOrders);
          setLastVisibleOrder(lastVisible);
          setHasMoreOrders(!!lastVisible);
        }
        setIsLoadingOrders(false);
      } else if (tab === AdminTab.Payments || tab === AdminTab.Statistics) {
        setIsLoadingOrders(true);
        await syncAllStats().catch(() => {});
        const data = debouncedSearchText ? await searchOrders(debouncedSearchText) : await getAllOrders();
        setOrders(data);
        setIsLoadingOrders(false);
      } else if (tab === AdminTab.Event) {
        const c = await getGlobalConfig();
        setConfig(c);
      } else if (tab === AdminTab.Confirmation) {
        setIsLoadingConfirmations(true);
        const data = debouncedSearchText ? await searchConfirmations(debouncedSearchText) : await getConfirmations();
        setConfirmations(data);
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
      }
    };
    fetchHistory();
  }, [registerPaymentOrder]);

  const handleRefreshMetrics = async () => {
    setIsProcessingConfig(true);
    await syncAllStats(); 
    const s = await getStats();
    setCurrentStats(s);
    if (tab === AdminTab.Payments || tab === AdminTab.Statistics || tab === AdminTab.Orders) {
        const data = debouncedSearchText ? await searchOrders(debouncedSearchText) : await getAllOrders();
        setOrders(data);
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

  const handleSyncConfirmations = async () => {
    setIsSyncingConfirmations(true);
    try {
      await syncConfirmationsFromOrders();
      const data = await getConfirmations();
      setConfirmations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncingConfirmations(false);
    }
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
    if (!securityModal.password) return;
    setIsProcessingConfig(true);
    let success = false;

    if (securityModal.type === 'lock') success = await updateGlobalConfig({ pedidosAbertos: false });
    else if (securityModal.type === 'unlock') success = await updateGlobalConfig({ pedidosAbertos: true });
    else if (securityModal.type === 'price') success = await updateGlobalConfig({ valorCamiseta: parseCurrencyToNumber(securityModal.newValue) });
    else if (securityModal.type === 'end') {
        const backupData = await fetchFullBackup();
        downloadJSONBackup(backupData);
        success = await endEvent();
    }

    if (success) await handleRefreshMetrics();
    setIsProcessingConfig(false);
    setSecurityModal({ type: null, password: '' });
  };

  const handleDelete = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    if (await deleteOrder(orderToDelete)) {
      setOrders(prev => prev.filter(o => o.docId !== orderToDelete.docId));
      setOrderToDelete(null);
      await handleRefreshMetrics();
    }
    setIsDeleting(false);
  };

  const handleRegisterPayment = async () => {
    if (!registerPaymentOrder || !paymentAmount) return;
    setIsProcessingPayment(true);
    if (await recordPayment(registerPaymentOrder.docId, parseCurrencyToNumber(paymentAmount), paymentDate)) {
      setRegisterPaymentOrder(null);
      setPaymentAmount('');
      await handleRefreshMetrics();
    }
    setIsProcessingPayment(false);
  };

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 border-b border-border-light pb-6">
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="font-black text-2xl md:text-3xl text-text-primary tracking-tight capitalize">{tab}</h2>
              <button onClick={handleRefreshMetrics} disabled={isProcessingConfig} className="text-primary hover:text-text-primary text-[10px] font-black uppercase tracking-widest">
                <i className={`fas fa-sync-alt ${isProcessingConfig ? 'fa-spin' : ''}`}></i> SYNC
              </button>
            </div>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">Controle Administrativo Premium</p>
        </div>
        <AdminMenu activeTab={tab} onSelectTab={handleTabSelect} />
      </div>

      {tab === AdminTab.Dashboard && (
        <DashboardTab handleAiAction={handleAiAction} isAnalysing={isAnalysing} onShowSizeMatrix={onShowSizeMatrix} aiAnalysis={aiAnalysis} currentStats={currentStats} />
      )}
      
      {tab === AdminTab.Payments && (
        <PaymentsTab searchText={searchText} setSearchText={setSearchText} isLoadingOrders={isLoadingOrders} orders={orders} setRegisterPaymentOrder={setRegisterPaymentOrder} setPaymentAmount={setPaymentAmount} />
      )}
      
      {tab === AdminTab.Orders && (
        <OrdersTab searchText={searchText} setSearchText={setSearchText} isLoadingOrders={isLoadingOrders} orders={orders} onEditOrder={onEditOrder} setOrderToDelete={setOrderToDelete} loadMoreOrders={() => {}} hasMoreOrders={hasMoreOrders} isLoadingMore={isLoadingMore} />
      )}
      
      {tab === AdminTab.Confirmation && (
        <ConfirmationTab searchText={searchText} setSearchText={setSearchText} confirmations={confirmations} isLoading={isLoadingConfirmations} onEdit={setEditingConfirmation} onSync={handleSyncConfirmations} isSyncing={isSyncingConfirmations} />
      )}

      {tab === AdminTab.Statistics && (
        <StatisticsTab orders={orders} isLoading={isLoadingOrders} />
      )}

      {tab === AdminTab.Event && (
        <EventTab config={config} setNewPrice={setNewPrice} setIsPriceModalOpen={setIsPriceModalOpen} formatNumberToCurrency={formatNumberToCurrency} setSecurityModal={setSecurityModal} />
      )}

      <Modal isOpen={!!registerPaymentOrder} onClose={() => setRegisterPaymentOrder(null)} title="Liquidar Pagamento">
         <div className="space-y-6">
            <CurrencyInput label="VALOR PAGO" value={paymentAmount} onChange={setPaymentAmount} />
            <Input label="DATA" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            <Button className="w-full h-14" onClick={handleRegisterPayment} disabled={isProcessingPayment}>CONFIRMAR</Button>
         </div>
      </Modal>

      <Modal isOpen={!!orderToDelete} onClose={() => setOrderToDelete(null)} title="Excluir Pedido">
        <div className="space-y-6 text-center">
          <p className="text-sm text-text-secondary font-bold uppercase tracking-wider">
            Tem certeza que deseja excluir o pedido <strong>{orderToDelete?.numPedido}</strong> de <strong>{orderToDelete?.nome}</strong>?
          </p>
          <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">Esta ação é irreversível e removerá todos os dados do banco.</p>
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1 h-14" onClick={() => setOrderToDelete(null)}>CANCELAR</Button>
            <Button variant="danger" className="flex-1 h-14" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <i className="fas fa-spinner fa-spin"></i> : "EXCLUIR DEFINITIVAMENTE"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!securityModal.type} onClose={() => setSecurityModal({ type: null, password: '' })} title="Segurança">
        <div className="space-y-6">
          <Input type="password" placeholder="SENHA MESTRE" value={securityModal.password} onChange={e => setSecurityModal({...securityModal, password: e.target.value})} />
          <Button className="w-full h-14" onClick={handleSecurityAction}>CONFIRMAR</Button>
        </div>
      </Modal>
    </div>
  );
};
