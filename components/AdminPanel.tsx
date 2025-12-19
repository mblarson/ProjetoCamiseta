
import React, { useState, useEffect, useMemo } from 'react';
import { AdminTab, Stats, Order, ColorData, PaymentHistory } from '../types';
import { Card, Button, Input, Modal } from './UI';
import { AdminMenu } from './AdminMenu';
import { analyzeSales } from '../services/aiService';
import { 
  getAllOrders, deleteOrder, getGlobalConfig, updateGlobalConfig, 
  endEvent, getStats, recordPayment, cancelLastPayment, getOrderById, getPaymentHistoryForOrder 
} from '../services/firebase';
import { generateOrderPDF } from '../services/pdfService';

interface AdminPanelProps {
  stats: Stats | null;
  onEditOrder: (order: Order) => void;
}

interface PaymentGroup {
  name: string;
  total: number;
  pago: number;
  restante: number;
  status: 'Pago' | 'Pendente';
  orders: Order[];
}

const getTabDescription = (tab: AdminTab) => {
    switch (tab) {
        case AdminTab.Dashboard: return "Visão geral e métricas do evento.";
        case AdminTab.Orders: return "Gerenciar todos os pedidos individuais.";
        case AdminTab.Payments: return "Controlar recebimentos por setor ou cidade.";
        case AdminTab.Event: return "Configurações gerais e ações críticas.";
        default: return "";
    }
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ stats: initialStats, onEditOrder }) => {
  const [tab, setTab] = useState<AdminTab>(AdminTab.Dashboard);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [currentStats, setCurrentStats] = useState<Stats | null>(initialStats);
  
  // Configuration States
  const [config, setConfig] = useState<{ pedidosAbertos: boolean, valorCamiseta: number }>({ pedidosAbertos: true, valorCamiseta: 30.00 });
  const [isProcessingConfig, setIsProcessingConfig] = useState(false);
  const [securityModal, setSecurityModal] = useState<{ type: 'lock' | 'unlock' | 'end' | 'price' | null, password: string, newValue?: any }>({ type: null, password: '' });

  // States for Orders and Payments
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [localFilter, setLocalFilter] = useState<'Todos' | 'Capital' | 'Interior'>('Todos');
  const [expandedSector, setExpandedSector] = useState<string | null>(null);
  
  // Modals for Payments (Combined into "Gerenciar")
  const [registerPaymentOrder, setRegisterPaymentOrder] = useState<Order | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [orderPaymentHistory, setOrderPaymentHistory] = useState<PaymentHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // States for price change modal
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');


  useEffect(() => {
    if (tab === AdminTab.Orders || tab === AdminTab.Payments) loadOrders();
    if (tab === AdminTab.Event) loadConfig();
  }, [tab]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (registerPaymentOrder) {
        setIsLoadingHistory(true);
        const history = await getPaymentHistoryForOrder(registerPaymentOrder);
        setOrderPaymentHistory(history);
        setIsLoadingHistory(false);
      } else {
        setOrderPaymentHistory([]); // Clear history when modal closes
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
    setExpandedSector(null);
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
      success = await updateGlobalConfig({ valorCamiseta: parseFloat(securityModal.newValue) });
      if (success) setConfig(prev => ({ ...prev, valorCamiseta: parseFloat(securityModal.newValue) }));
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
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Informe um valor válido.");
      return;
    }

    setIsProcessingPayment(true);
    const success = await recordPayment(registerPaymentOrder.docId, amount, paymentDate);
    
    if (success) {
      const updatedOrderFromServer = await getOrderById(registerPaymentOrder.docId);
      if (updatedOrderFromServer) {
        setRegisterPaymentOrder(updatedOrderFromServer); // This will trigger the useEffect to refetch history
      }

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

        if (updatedOrderFromServer) {
          setRegisterPaymentOrder(updatedOrderFromServer); // This will trigger the useEffect to refetch history
        }
        
        loadOrders();
        handleRefreshMetrics();
      } else {
        alert("Erro ao cancelar liquidação. A operação falhou no servidor. Verifique se existem pagamentos a serem cancelados.");
      }
    } catch (error) {
        console.error("🔥 [CANCEL_PAYMENT] CRITICAL ERROR during cancellation process for order:", orderId, error);
        alert("Ocorreu um erro crítico ao tentar cancelar a liquidação. Verifique o console para mais detalhes.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const groupedPayments = useMemo(() => {
    const groups: Record<string, PaymentGroup> = {};
    orders.forEach(o => {
      let key = o.setor.toUpperCase();
      if (o.local === 'Capital' && !key.startsWith('SETOR')) {
        key = `SETOR ${key}`;
      }
      
      if (!groups[key]) {
        groups[key] = {
          name: key,
          total: 0,
          pago: 0,
          restante: 0,
          status: 'Pendente',
          orders: []
        };
      }
      groups[key].total += o.valorTotal;
      groups[key].pago += (o.valorPago || 0);
      groups[key].orders.push(o);
    });

    return Object.entries(groups)
      .map(([_, g]) => {
        g.restante = g.total - g.pago;
        g.status = g.pago >= g.total ? 'Pago' : 'Pendente';
        return g;
      })
      .filter(g => !searchText || g.name.toLowerCase().includes(searchText.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders, searchText]);

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

  const formatSetor = (order: Order | null) => {
    if (!order) return '';
    return order.local === 'Capital' && !order.setor.toUpperCase().startsWith('SETOR') 
      ? `SETOR ${order.setor}` 
      : order.setor;
  };

  return (
    <div className="flex flex-col gap-10 animate-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 border-b border-border-light pb-8">
        <div>
            <h2 className="text-3xl font-black text-text-primary uppercase tracking-tighter capitalize">{tab}</h2>
            <p className="text-xs text-text-secondary font-bold uppercase tracking-widest mt-1">
                {getTabDescription(tab)}
            </p>
        </div>
        <AdminMenu activeTab={tab} onSelectTab={handleTabSelect} />
      </div>

      {/* Conteúdo: DASHBOARD */}
      {tab === AdminTab.Dashboard && (
        <div className="space-y-10 animate-in fade-in duration-700">
          <div className="flex justify-end">
            <button 
              onClick={handleAiAction} 
              disabled={isAnalysing} 
              className="w-full md:w-auto card px-6 py-4 flex items-center justify-center gap-4 border border-primary/20 hover:bg-primary/5 transition-all group"
            >
              <i className="fas fa-sparkles text-primary group-hover:rotate-12 transition-transform"></i>
              <span className="font-black tracking-[0.15em] text-[10px] uppercase">
                {isAnalysing ? "Consultando Gemini..." : "Análise Inteligente"}
              </span>
            </button>
          </div>

          {aiAnalysis && (
            <Card className="border-primary/30 bg-primary/5 border-dashed">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <i className="fas fa-robot text-primary text-sm"></i>
                </div>
                <h4 className="font-black text-[10px] uppercase tracking-widest text-primary">Insights da Inteligência Artificial</h4>
              </div>
              <div className="text-sm leading-relaxed text-text-secondary italic whitespace-pre-wrap pl-2">{aiAnalysis}</div>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="Volume de Pedidos" value={currentStats?.qtd_pedidos || 0} icon="fa-clipboard-list" description="Total de reservas" />
            <StatCard label="Total de Camisetas" value={currentStats?.qtd_camisetas || 0} icon="fa-shirt" description="Soma de todos os tamanhos" />
            <StatCard label="Receita Prevista" value={currentStats?.valor_total || 0} isMoney icon="fa-chart-line" description="Valor total bruto" accentColor="text-primary" />
            <StatCard label="Total Recebido" value={currentStats?.total_recebido_real || 0} isMoney icon="fa-money-bill-trend-up" description="Valores confirmados em caixa" accentColor="text-green-600" bgStyle="bg-green-500/5" />
          </div>
        </div>
      )}

      {/* Conteúdo: PAGAMENTOS */}
      {tab === AdminTab.Payments && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-text-primary uppercase tracking-tight">Pagamentos</h2>
            <button 
              onClick={handleRefreshMetrics}
              disabled={isProcessingConfig}
              className="flex items-center gap-2 text-primary hover:text-text-primary transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              <i className={`fas fa-sync-alt ${isProcessingConfig ? 'fa-spin' : ''}`}></i>
              Atualizar
            </button>
          </div>

          <div className="relative">
            <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-text-secondary/50 text-sm"></i>
            <input 
              type="text"
              placeholder="Buscar por Setor ou Cidade..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="w-full h-16 bg-surface border border-border-light rounded-2xl pl-14 pr-6 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-text-secondary/60"
            />
          </div>

          {isLoadingOrders ? (
            <LoadingPulse />
          ) : groupedPayments.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupedPayments.map(group => (
                <div key={group.name} className="flex flex-col gap-4">
                  <PaymentGroupCard 
                    group={group} 
                    isExpanded={expandedSector === group.name}
                    onToggle={() => setExpandedSector(expandedSector === group.name ? null : group.name)}
                  />
                  {expandedSector === group.name && (
                    <div className="space-y-3 animate-in slide-in-from-top-4 duration-500 pl-4 border-l-2 border-primary/30">
                      {group.orders.map(order => (
                        <div key={order.docId} className="card p-5 flex justify-between items-center hover:bg-background transition-all">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-80">Valor do Pedido</span>
                            <span className="text-lg font-black text-text-primary tracking-tighter">
                              {order.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <div className="flex items-center gap-2">
                               <span className={`w-1.5 h-1.5 rounded-full ${order.statusPagamento === 'Pago' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                               <span className="text-[8px] font-bold text-text-secondary uppercase tracking-widest">{order.statusPagamento}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setRegisterPaymentOrder(order);
                              setPaymentAmount('');
                            }}
                            className="bg-primary-light border border-primary/20 text-primary hover:bg-primary hover:text-white transition-all px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest active:scale-95"
                          >
                            GERENCIAR
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conteúdo: PEDIDOS */}
      {tab === AdminTab.Orders && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
            <div className="lg:col-span-2">
              <Input 
                label="Pesquisar por Líder, Código ou Setor" 
                placeholder="Ex: João Silva, PED-A1B2, Dourados..." 
                value={searchText} 
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-3">
              <label className="text-[10px] uppercase font-black tracking-widest text-primary/70 px-1">Filtrar Local</label>
              <div className="flex flex-wrap gap-2">
                {['Todos', 'Capital', 'Interior'].map(loc => (
                  <button 
                    key={loc} 
                    onClick={() => setLocalFilter(loc as any)}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${localFilter === loc ? 'bg-primary border-primary text-white' : 'border-border-light text-text-secondary hover:border-primary/30'}`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {isLoadingOrders ? (
              <LoadingPulse />
            ) : orders.length === 0 ? (
              <EmptyState />
            ) : (
              orders.filter(o => {
                const searchLower = searchText.toLowerCase().trim();
                const matchesSearch = !searchLower || o.numPedido.toLowerCase().includes(searchLower) || o.nome.toLowerCase().includes(searchLower) || o.setor.toLowerCase().includes(searchLower);
                const matchesLocal = localFilter === 'Todos' || o.local === localFilter;
                return matchesSearch && matchesLocal;
              }).map(order => (
                <OrderListItem 
                  key={order.docId} 
                  order={order} 
                  isExpanded={expandedSector === order.docId}
                  onToggle={() => setExpandedSector(expandedSector === order.docId ? null : order.docId)}
                  onPDF={() => generateOrderPDF(order)}
                  onDelete={() => setOrderToDelete(order)}
                  shirtCount={getShirtCount(order)}
                  displaySetor={formatSetor(order)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Conteúdo: EVENTO */}
      {tab === AdminTab.Event && (
        <div className="space-y-10 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <EventActionCard 
              icon="fa-money-bill-1-wave" 
              title="Valor Unitário" 
              desc={config.valorCamiseta.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}
              highlightDesc
              onClick={() => {
                setNewPrice(config.valorCamiseta.toFixed(2));
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
        </div>
      )}

      {/* Modal Redesenhado: Liquidar Pagamento (Baseado no anexo) */}
      <Modal 
        isOpen={!!registerPaymentOrder} 
        onClose={() => setRegisterPaymentOrder(null)} 
        title="Liquidar Pagamento"
      >
        <div className="space-y-8">
          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">VALOR PAGO</label>
              <input 
                type="number" 
                step="0.01" 
                placeholder="R$ 0,00" 
                value={paymentAmount} 
                onChange={e => setPaymentAmount(e.target.value)} 
                className="w-full bg-background border border-border-light rounded-2xl h-16 px-6 text-text-primary text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">DATA DO RECEBIMENTO</label>
              <input 
                type="date" 
                value={paymentDate} 
                onChange={e => setPaymentDate(e.target.value)} 
                className="w-full bg-background border border-border-light rounded-2xl h-16 px-6 text-text-primary text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
            </div>
          </div>

          <button 
            className="w-full h-16 rounded-full font-black tracking-[0.2em] text-white uppercase text-sm bg-primary hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60" 
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
      
      {/* Modal para alterar preço */}
      <Modal isOpen={isPriceModalOpen} onClose={() => setIsPriceModalOpen(false)} title="Alterar Valor da Camiseta">
        <div className="space-y-6">
          <div className="p-8 bg-background border border-border-light rounded-3xl">
            <Input 
              label="NOVO VALOR UNITÁRIO (R$)"
              type="number"
              step="0.01"
              value={newPrice}
              onChange={e => setNewPrice(e.target.value)}
              placeholder="Ex: 35.00"
              className="text-center text-2xl font-black h-16"
              autoFocus
            />
          </div>
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1 h-16" onClick={() => setIsPriceModalOpen(false)}>CANCELAR</Button>
            <Button 
              className="flex-1 h-16"
              onClick={() => {
                if (newPrice && !isNaN(parseFloat(newPrice)) && parseFloat(newPrice) > 0) {
                  setIsPriceModalOpen(false);
                  setSecurityModal({ type: 'price', password: '', newValue: newPrice });
                } else {
                  alert("Por favor, insira um valor numérico válido e maior que zero.");
                }
              }}
              disabled={!newPrice || isNaN(parseFloat(newPrice)) || parseFloat(newPrice) <= 0}
            >
              SALVAR
            </Button>
          </div>
        </div>
      </Modal>

      {/* Outros Modais (Segurança, Exclusão) */}
      <Modal isOpen={!!securityModal.type} onClose={() => setSecurityModal({ type: null, password: '' })} title="Verificação Mestre">
        <div className="space-y-6">
          <div className="p-8 bg-background border border-primary/20 rounded-3xl text-center">
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

const PaymentGroupCard: React.FC<{ group: PaymentGroup, isExpanded: boolean, onToggle: () => void }> = ({ group, isExpanded, onToggle }) => (
  <button 
    onClick={onToggle}
    className={`w-full card p-6 text-left flex flex-col gap-6 group transition-all duration-300 hover:shadow-xl active:scale-[0.98] ${isExpanded ? 'ring-2 ring-primary' : 'hover:border-primary/40'}`}
  >
    <div className="flex justify-between items-start">
      <div className="flex items-center gap-3">
        <i className="fas fa-location-dot text-primary text-lg opacity-80 group-hover:scale-110 group-hover:rotate-6 transition-transform"></i>
        <h3 className="text-lg font-black text-text-primary uppercase tracking-tight">{group.name}</h3>
      </div>
      <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-[0.15em] border ${group.status === 'Pago' ? 'border-green-500/40 bg-green-500/10 text-green-500' : 'border-red-500/40 bg-red-500/10 text-red-500'}`}>
        {group.status}
      </span>
    </div>

    <div className="grid grid-cols-3 gap-4 border-t border-border-light pt-5">
      <div className="flex flex-col gap-0.5">
        <p className="text-[7px] font-black text-text-secondary uppercase tracking-widest">Total</p>
        <p className="text-[13px] font-black text-text-primary tracking-tighter whitespace-nowrap">{group.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-[7px] font-black text-text-secondary uppercase tracking-widest">Pago</p>
        <p className={`text-[13px] font-black tracking-tighter whitespace-nowrap ${group.pago > 0 ? 'text-green-600' : 'text-red-500/60'}`}>{group.pago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-[7px] font-black text-text-secondary uppercase tracking-widest">Restante</p>
        <p className={`text-[13px] font-black tracking-tighter whitespace-nowrap ${group.restante > 0 ? 'text-text-primary' : 'text-green-600/70'}`}>{group.restante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
      </div>
    </div>

    <div className="flex justify-center pt-1 mt-auto">
      <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px] text-text-secondary/60 group-hover:text-primary transition-all duration-300 ${isExpanded ? 'text-primary' : ''}`}></i>
    </div>
  </button>
);

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

const EventActionCard: React.FC<{ icon: string, title: string, desc: string, onClick: () => void, variant?: 'danger' | 'success' | 'default', loading?: boolean, highlightDesc?: boolean }> = ({ icon, title, desc, onClick, variant = 'default', loading, highlightDesc }) => (
  <button 
    onClick={onClick}
    disabled={loading}
    className={`card p-8 text-left group relative overflow-hidden flex flex-row items-center gap-6 w-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${variant === 'danger' ? 'hover:border-red-500/50 hover:bg-red-500/5' : variant === 'success' ? 'hover:border-green-500/50 hover:bg-green-500/5' : 'hover:border-primary/50 hover:bg-primary/5'}`}
  >
    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-2xl transition-all duration-500 shrink-0 group-hover:scale-110 group-hover:rotate-3 ${variant === 'danger' ? 'bg-red-500/10 text-red-500' : variant === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'}`}>
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

const OrderListItem: React.FC<{ 
  order: Order, 
  isExpanded: boolean, 
  onToggle: () => void,
  onPDF: () => void,
  onDelete: () => void,
  shirtCount: number,
  displaySetor: string
}> = ({ order, isExpanded, onToggle, onPDF, onDelete, shirtCount, displaySetor }) => {
  const whatsappUrl = `https://wa.me/${order.contato.replace(/\D/g, '')}`;

  return (
    <div className={`card overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-1 ring-primary/40 shadow-lg' : 'hover:bg-background/80'}`}>
      <div className="p-6 cursor-pointer relative" onClick={onToggle}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2 w-full">
            <h3 className="text-sm font-black text-text-primary tracking-widest uppercase leading-none">Pedido #{order.numPedido}</h3>
            <p className="text-primary font-black text-[10px] uppercase tracking-[0.2em] opacity-80">
              {shirtCount} peças • {order.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <div className="space-y-1">
              <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">
                {order.nome} | {order.local} – {displaySetor}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-secondary/70 font-bold tracking-widest">{order.contato}</span>
                <a 
                  href={whatsappUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-green-500 hover:text-green-400 transition-colors flex items-center justify-center p-1"
                >
                  <i className="fab fa-whatsapp text-sm"></i>
                </a>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 absolute right-6 top-6 md:static">
            <div className={`transition-transform duration-500 text-primary/30 ${isExpanded ? 'rotate-180' : ''}`}>
              <i className="fas fa-chevron-down text-lg"></i>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-8 bg-background/70 border-t border-border-light animate-in slide-in-from-top-4 duration-500">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                <p className="text-[11px] font-black text-text-primary uppercase tracking-[0.2em]">Detalhamento do Pedido</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <ColorSummary label="Verde Oliva" data={order.verdeOliva} hex="#3b4a3c" />
                <ColorSummary label="Terracota" data={order.terracota} hex="#a35e47" />
              </div>
            </div>
            {order.observacao && (
              <div className="p-4 rounded-xl bg-surface border border-border-light">
                <p className="text-[9px] font-black text-primary/50 uppercase tracking-widest mb-2">Observações</p>
                <p className="text-sm text-text-secondary italic">"{order.observacao}"</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border-light">
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                className="flex items-center justify-center gap-2 px-4 py-4 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-black uppercase hover:bg-red-500 hover:text-white transition-all w-full"
              >
                <i className="fas fa-trash-alt"></i>
                <span className="hidden sm:inline">Excluir Pedido</span>
                <span className="sm:hidden text-[8px]">Excluir</span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onPDF(); }} 
                className="flex items-center justify-center gap-2 px-4 py-4 rounded-full bg-primary text-white text-[10px] font-black uppercase hover:brightness-110 transition-all w-full"
              >
                <i className="fas fa-file-pdf"></i>
                <span className="hidden sm:inline">Baixar Pedido (PDF)</span>
                <span className="sm:hidden text-[8px]">PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ColorSummary: React.FC<{ label: string, data?: ColorData, hex: string }> = ({ label, data, hex }) => {
  if (!data) return null;
  const cats = ['infantil', 'babylook', 'unissex'] as const;
  const items: any[] = [];
  cats.forEach(c => {
    Object.entries(data[c] || {}).forEach(([s, q]) => {
      if ((q as number) > 0) items.push({ c, s, q });
    });
  });
  if (items.length === 0) return null;
  return (
    <div className="bg-surface p-5 rounded-2xl border border-border-light">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full shadow-lg" style={{ backgroundColor: hex }}></div>
        <span className="text-[11px] font-black text-text-primary uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex justify-between text-[10px] border-b border-border-light pb-2 last:border-0 last:pb-0">
            <span className="text-text-secondary font-bold uppercase tracking-widest">{it.c} ({it.s})</span>
            <span className="text-text-primary font-black">{it.q}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: number, isMoney?: boolean, icon: string, description: string, accentColor?: string, bgStyle?: string }> = ({ label, value, isMoney, icon, description, accentColor = "text-text-primary", bgStyle = "bg-surface" }) => (
  <Card className={`hover:border-primary/30 transition-all duration-500 group relative overflow-hidden ${bgStyle}`}>
    <div className="absolute -right-4 -top-4 opacity-5 text-7xl transition-transform group-hover:scale-125 group-hover:rotate-6 text-text-primary">
      <i className={`fas ${icon}`}></i>
    </div>
    <div className="flex flex-col h-full justify-between">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className={`w-2 h-2 rounded-full ${accentColor.replace('text-', 'bg-')}`}></div>
          <p className="text-[9px] text-text-secondary font-black uppercase tracking-[0.2em]">{label}</p>
        </div>
        <p className="text-[8px] text-text-secondary/70 font-bold uppercase tracking-widest mb-4">{description}</p>
      </div>
      <p className={`text-3xl font-light tracking-tighter ${accentColor}`}>
        {isMoney ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : value}
      </p>
    </div>
  </Card>
);