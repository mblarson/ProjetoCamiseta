
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
  getFirestore, initializeFirestore, collection, getDocs, query, where, 
  doc, getDoc, setDoc, runTransaction, increment, limit, Firestore, updateDoc, orderBy, deleteDoc, writeBatch,
  DocumentSnapshot, startAfter, documentId
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
// @ts-ignore
import { getAuth, signInAnonymously, Auth, User, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { Order, Stats, PaymentHistory, ColorData, UnifiedCity } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyA1I6zqowDo3k8eG1A1c-1hnGBofNX6PoA",
  authDomain: "projetocamisetas-579c1.firebaseapp.com",
  projectId: "projetocamisetas-579c1",
  storageBucket: "projetocamisetas-579c1.firebasestorage.app",
  messagingSenderId: "1071111878440",
  appId: "1:1071111878440:web:2f9989f610f7fc3b8e421d",
  measurementId: "G-E6YN91JJFG"
};

class FirebaseService {
  private static instance: FirebaseService;
  public db: Firestore;
  public auth: Auth;
  private authPromise: Promise<User> | null = null;
  public isReady: boolean = false;

  private constructor() {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      
      // Use long polling to avoid WebSocket issues in restricted environments (like iframes)
      this.db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        useFetchStreams: false
      });
      
      // Add global listener for IndexedDB errors which can happen in restricted environments
      window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && event.reason.message && event.reason.message.includes('IndexedDB')) {
          console.warn('⚠️ IndexedDB error detected, likely due to browser restrictions:', event.reason.message);
          // Prevent the error from crashing the app if possible
          event.preventDefault();
        }
      });
      
      this.auth = getAuth(app);
      
      // Try local persistence, fallback to session if it fails (common in restricted iframes/IndexedDB issues)
      setPersistence(this.auth, browserLocalPersistence)
        .catch(() => {
          console.warn("⚠️ Local persistence failed, falling back to session persistence.");
          return setPersistence(this.auth, browserSessionPersistence);
        })
        .catch(err => {
          console.error("❌ Auth Persistence Error:", err.message);
        });

    } catch (e) {
      console.error("🔥 Firebase Init Error:", e);
      // Don't rethrow here to allow the app to at least render UI
    }
  }

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  public handleFirebaseError(e: any, context?: string) {
    const msg = (e.message || "").toLowerCase();
    const code = e.code || "";
    const user = this.auth.currentUser;
    
    console.group(`🔥 ERRO FIREBASE ${context ? `[${context}]` : ''}`);
    console.error("Código:", code);
    console.error("Mensagem:", e.message);
    console.log("Usuário:", user ? (user.isAnonymous ? "Anônimo" : user.email) : "Deslogado");
    console.groupEnd();
    
    if (code === "permission-denied" || msg.includes("insufficient permissions") || msg.includes("rules_denied")) {
      throw new Error("RULES_DENIED");
    }

    if (code === "auth/operation-not-allowed") {
      throw new Error("AUTH_DISABLED");
    }

    if (code === "auth/network-request-failed" || msg.includes("network-request-failed")) {
      alert("⚠️ Erro de conexão com o servidor. Verifique sua internet ou se o navegador está bloqueando o acesso ao Firebase.");
    }

    throw e;
  }

  public async connect(retries = 3): Promise<User> {
    if (this.auth.currentUser) {
      this.isReady = true;
      return this.auth.currentUser;
    }
    if (this.authPromise) return this.authPromise;
    
    const attemptSignIn = async (attempt: number): Promise<User> => {
      try {
        const cred = await signInAnonymously(this.auth);
        this.isReady = true;
        return cred.user;
      } catch (err: any) {
        console.error(`❌ Conexão anônima falhou (Tentativa ${attempt}/${retries}):`, err.message);
        
        if (attempt < retries && (err.code === 'auth/network-request-failed' || err.message.includes('network'))) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`🔄 Retentando em ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptSignIn(attempt + 1);
        }
        
        this.authPromise = null;
        throw err;
      }
    };

    this.authPromise = attemptSignIn(1);
    return this.authPromise;
  }
}

const service = FirebaseService.getInstance();
export const auth = service.auth;
export const db = service.db;
export const connectFirebase = () => service.connect();
export const isFirebaseReady = () => service.isReady;

export const signInWithEmail = async (email, password) => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        return { success: true };
    } catch (error: any) {
        return { success: false, code: error.code };
    }
};

export const signOutUser = async () => {
    try {
        await signOut(auth);
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Sign Out Error:", error);
    }
};

export interface GlobalConfig {
  pedidosAbertos: boolean;
  valorCamiseta: number;
  currentBatch: number;
}

const getPaymentDocId = (order: Pick<Order, 'local' | 'setor'>): string => {
  let key = order.setor.toUpperCase().trim();
  if (order.local === 'Capital' && !key.startsWith('SETOR') && key !== 'UMADEMATS') {
    key = `SETOR ${key}`;
  }
  return key;
};

const calculateShirtCount = (order: Partial<Order>) => {
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

export const syncAllStats = async () => {
  try {
    await service.connect();
    const ordersSnap = await getDocs(collection(db, "pedidos"));
    
    let totalCamisetas = 0;
    let totalPrevisto = 0;
    let totalRecebido = 0;
    let totalPedidos = 0;
    let pagos = 0;
    let parciais = 0;
    let pendentes = 0;
    let totalInfantil = 0;
    let totalBabylook = 0;
    let totalUnissex = 0;

    const batches: Record<number, { qtd_pedidos: number, qtd_camisetas: number, valor_total: number }> = {};

    const countCategory = (catData?: Record<string, number>) => {
      if (!catData) return 0;
      return Object.values(catData).reduce((a, b) => a + (b || 0), 0);
    };

    ordersSnap.forEach(doc => {
      const data = doc.data() as Order;
      
      // Regra: Ignorar pedidos marcados como excluídos (soft delete)
      if ((data as any).deleted === true || (data as any).excluido === true) return;

      const lote = data.lote || 1; // Fallback LOTE 1

      if (!batches[lote]) {
        batches[lote] = { qtd_pedidos: 0, qtd_camisetas: 0, valor_total: 0 };
      }

      const shirts = calculateShirtCount(data);
      const valTotal = data.valorTotal || 0;

      batches[lote].qtd_pedidos++;
      batches[lote].qtd_camisetas += shirts;
      batches[lote].valor_total += valTotal;

      totalPedidos++;
      totalCamisetas += shirts;
      totalPrevisto += valTotal;
      totalRecebido += (data.valorPago || 0);

      // Calcular contagens globais por categoria
      if (data.verdeOliva) {
        totalInfantil += countCategory(data.verdeOliva.infantil);
        totalBabylook += countCategory(data.verdeOliva.babylook);
        totalUnissex += countCategory(data.verdeOliva.unissex);
      }
      if (data.terracota) {
        totalInfantil += countCategory(data.terracota.infantil);
        totalBabylook += countCategory(data.terracota.babylook);
        totalUnissex += countCategory(data.terracota.unissex);
      }

      if (data.statusPagamento === 'Pago') pagos++;
      else if (data.statusPagamento === 'Parcial') parciais++;
      else pendentes++;
    });

    const statsRef = doc(db, "configuracoes", "estatisticas");
    // Usamos setDoc SEM merge: true para garantir que o campo 'batches' seja substituído inteiramente,
    // removendo lotes que não possuem mais pedidos (como o Lote 4 revertido).
    await setDoc(statsRef, {
      qtd_pedidos: totalPedidos,
      qtd_camisetas: totalCamisetas,
      valor_total: totalPrevisto,
      total_recebido_real: totalRecebido,
      pedidos_pagos: pagos,
      pedidos_parciais: parciais,
      pedidos_pendentes: pendentes,
      batches: batches,
      qtd_infantil: totalInfantil,
      qtd_babylook: totalBabylook,
      qtd_unissex: totalUnissex
    });

    return true;
  } catch (e: any) {
    console.warn("⚠️ Falha ao sincronizar estatísticas (pode ser falta de permissão):", e.message);
    return false;
  }
};

export const fetchFullBackup = async () => {
  try {
    await service.connect();
    const [ordersSnap, paymentsSnap, statsSnap, configSnap] = await Promise.all([
      getDocs(collection(db, "pedidos")),
      getDocs(collection(db, "pagamentos")),
      getDoc(doc(db, "configuracoes", "estatisticas")),
      getDoc(doc(db, "configuracoes", "geral"))
    ]);

    return {
      backupDate: new Date().toISOString(),
      evento: "UMADEMATS - JUBILEU DE OURO",
      config: configSnap.data(),
      pedidos: ordersSnap.docs.map(d => ({ docId: d.id, ...d.data(), lote: d.data().lote || 1 })),
      pagamentos: paymentsSnap.docs.map(d => ({ docId: d.id, ...d.data() })),
      estatisticasFinal: statsSnap.exists() ? statsSnap.data() : null
    };
  } catch (e: any) {
    service.handleFirebaseError(e, "Backup");
    throw e;
  }
};

export const recalculateTotalsAfterPriceChange = async (newPrice: number) => {
  try {
    await service.connect();
    const ordersQuery = query(collection(db, "pedidos"));
    const ordersSnap = await getDocs(ordersQuery);
    const batch = writeBatch(db);

    ordersSnap.forEach(orderDoc => {
      const orderData = orderDoc.data() as Order;
      const shirtCount = calculateShirtCount(orderData);
      const newOrderTotal = shirtCount * newPrice;
      
      const orderRef = doc(db, "pedidos", orderDoc.id);
      batch.update(orderRef, { valorTotal: newOrderTotal });
    });

    await batch.commit();
    await syncAllStats();
    return true;
  } catch (e: any) {
    service.handleFirebaseError(e, "Recalculate Price");
    return false;
  }
};

export const getPaymentHistoryForOrder = async (order: Order): Promise<PaymentHistory[]> => {
  try {
      await service.connect();
      const paymentDocId = getPaymentDocId(order);
      const paymentLogRef = doc(db, "pagamentos", paymentDocId);
      const paymentLogSnap = await getDoc(paymentLogRef);

      if (!paymentLogSnap.exists()) {
          return [];
      }

      const allLiquidacoes = paymentLogSnap.data().liquidacoes || [];
      const orderPayments = allLiquidacoes.filter((p: any) => p.pedidoId === order.docId);
      return orderPayments as PaymentHistory[];
  } catch (e: any) {
      service.handleFirebaseError(e, "Get Payment History");
      return [];
  }
};

export const getGlobalConfig = async (): Promise<GlobalConfig> => {
  try {
    await service.connect();
    const snap = await getDoc(doc(db, "configuracoes", "geral"));
    if (snap.exists()) {
        const data = snap.data() as GlobalConfig;
        return { ...data, currentBatch: data.currentBatch || 1 };
    }
  } catch (e: any) { 
    console.warn("Configurações não encontradas, usando padrões.");
  }
  return { pedidosAbertos: true, valorCamiseta: 30.00, currentBatch: 1 };
};

export const updateGlobalConfig = async (data: Partial<GlobalConfig>) => {
  try {
    await service.connect();
    const configRef = doc(db, "configuracoes", "geral");
    await setDoc(configRef, data, { merge: true });
    
    if (data.valorCamiseta !== undefined) {
      await recalculateTotalsAfterPriceChange(data.valorCamiseta);
    }
    return true;
  } catch (e: any) {
      service.handleFirebaseError(e, "Update Config");
      return false;
  }
};

export const createNewBatch = async (newBatchNumber: number) => {
    try {
        await service.connect();
        await updateGlobalConfig({ currentBatch: newBatchNumber });
        await syncAllStats();
        return true;
    } catch (e: any) {
        service.handleFirebaseError(e, "Create Batch");
        return false;
    }
};

export const deleteLastBatch = async () => {
    try {
        await service.connect();
        const config = await getGlobalConfig();
        const batchToDelete = config.currentBatch;

        if (batchToDelete <= 1) return false;

        const ordersQuery = query(collection(db, "pedidos"), where("lote", "==", batchToDelete));
        const ordersSnap = await getDocs(ordersQuery);
        
        const batch = writeBatch(db);

        ordersSnap.forEach(d => batch.delete(d.ref));
        
        const configRef = doc(db, "configuracoes", "geral");
        batch.update(configRef, { currentBatch: batchToDelete - 1 });

        await batch.commit();
        await syncAllStats();
        return true;
    } catch (e: any) {
        service.handleFirebaseError(e, "Delete Batch");
        return false;
    }
};

export const recordPayment = async (orderId: string, amount: number, date?: string) => {
  try {
    await service.connect();
    return await runTransaction(db, async (transaction) => {
      const orderRef = doc(db, "pedidos", orderId);
      const statsRef = doc(db, "configuracoes", "estatisticas");
      
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists()) throw new Error("Pedido não encontrado");
      
      const orderData = orderSnap.data() as Order;
      const lote = orderData.lote || 1;
      const paymentDocId = getPaymentDocId(orderData);
      const paymentLogRef = doc(db, "pagamentos", paymentDocId);

      const statsSnap = await transaction.get(statsRef);
      const paymentLogSnap = await transaction.get(paymentLogRef);
      
      const oldStatus = orderData.statusPagamento;
      const newValorPago = (orderData.valorPago || 0) + amount;
      
      let newStatus: 'Pendente' | 'Parcial' | 'Pago' = 'Parcial';
      if (newValorPago >= orderData.valorTotal) newStatus = 'Pago';
      else if (newValorPago <= 0) newStatus = 'Pendente';

      let displayDate = date;
      if (date && date.includes('-')) {
        const [y, m, d] = date.split('-');
        displayDate = `${d}/${m}/${y}`;
      }

      const timestamp = new Date().toISOString();
      const liquidacaoId = `${orderId}-${timestamp}`;

      const historyEntry: PaymentHistory = {
        valor: amount,
        data: displayDate || new Date().toLocaleDateString('pt-BR'),
        timestamp,
        liquidacaoId
      };

      transaction.update(orderRef, {
        valorPago: newValorPago,
        statusPagamento: newStatus,
      });

      const paymentLogEntry = {
        ...historyEntry,
        pedidoId: orderId,
        numPedido: orderData.numPedido,
        nomeLider: orderData.nome,
        lote: lote
      };
      
      if (paymentLogSnap.exists()) {
        const currentLiquidacoes = paymentLogSnap.data().liquidacoes || [];
        transaction.update(paymentLogRef, {
          liquidacoes: [...currentLiquidacoes, paymentLogEntry]
        });
      } else {
        transaction.set(paymentLogRef, {
          liquidacoes: [paymentLogEntry]
        });
      }

      if (statsSnap.exists()) {
        const statsUpdate: any = {
          total_recebido_real: increment(amount),
        };

        if (oldStatus !== newStatus) {
          if (oldStatus === 'Pendente') statsUpdate.pedidos_pendentes = increment(-1);
          if (oldStatus === 'Parcial') statsUpdate.pedidos_parciais = increment(-1);
          if (oldStatus === 'Pago') statsUpdate.pedidos_pagos = increment(-1);
          
          if (newStatus === 'Pendente') statsUpdate.pedidos_pendentes = increment(1);
          if (newStatus === 'Parcial') statsUpdate.pedidos_parciais = increment(1);
          if (newStatus === 'Pago') statsUpdate.pedidos_pagos = increment(1);
        }
        
        transaction.update(statsRef, statsUpdate);
      }

      return true;
    });
  } catch (e: any) { service.handleFirebaseError(e, "Record Payment"); return false; }
};

export const cancelLastPayment = async (orderId: string) => {
  try {
    await service.connect();
    return await runTransaction(db, async (transaction) => {
      const orderRef = doc(db, "pedidos", orderId);
      const statsRef = doc(db, "configuracoes", "estatisticas");
      
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists()) throw new Error("Pedido não encontrado");
      
      const orderData = orderSnap.data() as Order;
      const paymentDocId = getPaymentDocId(orderData);
      const paymentLogRef = doc(db, "pagamentos", paymentDocId);

      const statsSnap = await transaction.get(statsRef);
      const paymentLogSnap = await transaction.get(paymentLogRef);
      
      if (!paymentLogSnap.exists()) return false;

      const allLiquidacoes = paymentLogSnap.data().liquidacoes || [];
      const orderPayments = allLiquidacoes
        .filter((p: any) => p.pedidoId === orderId)
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (orderPayments.length === 0) return false;
      const lastPayment = orderPayments[0];
      
      const amountToCancel = lastPayment.valor;
      const oldStatus = orderData.statusPagamento;
      const newValorPago = Math.max(0, (orderData.valorPago || 0) - amountToCancel);
      
      let newStatus: 'Pendente' | 'Parcial' | 'Pago' = 'Pendente';
      if (newValorPago >= orderData.valorTotal) newStatus = 'Pago';
      else if (newValorPago > 0) newStatus = 'Parcial';

      transaction.update(orderRef, {
        valorPago: newValorPago,
        statusPagamento: newStatus,
      });

      const updatedLiquidacoes = allLiquidacoes.filter(
        (p: any) => p.liquidacaoId !== lastPayment.liquidacaoId
      );
      transaction.update(paymentLogRef, { liquidacoes: updatedLiquidacoes });

      if (statsSnap.exists()) {
        const statsUpdate: any = {
          total_recebido_real: increment(-amountToCancel)
        };

        if (oldStatus !== newStatus) {
          if (oldStatus === 'Pendente') statsUpdate.pedidos_pendentes = increment(-1);
          if (oldStatus === 'Parcial') statsUpdate.pedidos_parciais = increment(-1);
          if (oldStatus === 'Pago') statsUpdate.pedidos_pagos = increment(-1);
          
          if (newStatus === 'Pendente') statsUpdate.pedidos_pendentes = increment(1);
          if (newStatus === 'Parcial') statsUpdate.pedidos_parciais = increment(1);
          if (newStatus === 'Pago') statsUpdate.pedidos_pagos = increment(1);
        }
        
        transaction.update(statsRef, statsUpdate);
      }

      return true;
    });
  } catch (e: any) { 
    return false;
  }
};

export const endEvent = async () => {
  try {
    await service.connect();
    
    const [ordersSnap, paymentsSnap] = await Promise.all([
      getDocs(collection(db, "pedidos")),
      getDocs(collection(db, "pagamentos"))
    ]);

    const allDocs = [
      ...ordersSnap.docs,
      ...paymentsSnap.docs
    ];

    const MAX_BATCH_SIZE = 500;
    
    for (let i = 0; i < allDocs.length; i += MAX_BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = allDocs.slice(i, i + MAX_BATCH_SIZE);
      
      chunk.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      
      await batch.commit();
    }

    await setDoc(doc(db, "configuracoes", "estatisticas"), {
      qtd_pedidos: 0,
      qtd_camisetas: 0,
      valor_total: 0,
      total_recebido_real: 0,
      qtd_infantil: 0,
      qtd_babylook: 0,
      qtd_unissex: 0,
      pedidos_pagos: 0,
      pedidos_pendentes: 0,
      pedidos_parciais: 0,
      batches: {} 
    });
    
    await updateGlobalConfig({ currentBatch: 1 });

    return true;
  } catch (e: any) { 
    service.handleFirebaseError(e, "End Event"); 
    return false; 
  }
};

export const getStats = async (): Promise<Stats> => {
  const defaultStats: Stats = { qtd_pedidos: 0, qtd_camisetas: 0, valor_total: 0, total_recebido_real: 0, qtd_infantil: 0, qtd_babylook: 0, qtd_unissex: 0, pedidos_pagos: 0, pedidos_pendentes: 0, pedidos_parciais: 0, batches: {} };
  try {
    await service.connect();
    const statsSnap = await getDoc(doc(db, "configuracoes", "estatisticas"));
    return statsSnap.exists() ? statsSnap.data() as Stats : defaultStats;
  } catch (e: any) { 
    console.warn("Estatísticas protegidas ou indisponíveis.");
  }
  return defaultStats;
};

export const getAllOrders = async (): Promise<Order[]> => {
  try {
    await service.connect();
    const q = query(collection(db, "pedidos"), orderBy("data", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        return { docId: d.id, ...data, lote: data.lote || 1 } as Order; // Fallback LOTE 1
    }).filter(o => !(o as any).deleted && !(o as any).excluido);
  } catch (e: any) { service.handleFirebaseError(e, "Get All Orders"); return []; }
};

export const saveUnifiedCity = async (unifiedCity: UnifiedCity) => {
  try {
    await service.connect();
    const ref = unifiedCity.id 
      ? doc(db, "cidades_unificadas", unifiedCity.id)
      : doc(collection(db, "cidades_unificadas"));
    
    const data = { ...unifiedCity, createdAt: unifiedCity.createdAt || new Date().toISOString() };
    if (!unifiedCity.id) delete (data as any).id;
    
    await setDoc(ref, data);
    return true;
  } catch (e: any) {
    service.handleFirebaseError(e, "Save Unified City");
    return false;
  }
};

export const getUnifiedCities = async (): Promise<UnifiedCity[]> => {
  try {
    await service.connect();
    const snap = await getDocs(collection(db, "cidades_unificadas"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as UnifiedCity));
  } catch (e: any) {
    service.handleFirebaseError(e, "Get Unified Cities");
    return [];
  }
};

export const deleteUnifiedCity = async (id: string) => {
  try {
    await service.connect();
    await deleteDoc(doc(db, "cidades_unificadas", id));
    return true;
  } catch (e: any) {
    service.handleFirebaseError(e, "Delete Unified City");
    return false;
  }
};

const ORDERS_PAGE_SIZE = 100;

/**
 * Busca pedidos de forma segura evitando erros de índice composto do Firestore.
 * Implementa a regra de "Padronização de Lote" onde registros sem lote são considerados LOTE 1.
 * Para garantir compatibilidade e evitar a criação manual de índices, utilizamos filtragem e ordenação em memória quando filtros são aplicados.
 */
export const getPaginatedOrders = async (lastVisible?: DocumentSnapshot, loteFilter?: number): Promise<{ orders: Order[], lastVisible: DocumentSnapshot | null }> => {
  try {
    await service.connect();
    
    // Se houver um filtro de lote (exceto 999 que é 'Todos'), buscamos todos e processamos em memória para evitar index errors e aplicar o fallback.
    if (loteFilter && loteFilter !== 999) {
      const snap = await getDocs(collection(db, "pedidos"));
      
      // Mapeia e aplica fallback de LOTE 1 e filtro de exclusão
      let filteredOrders = snap.docs.map(d => {
        const data = d.data();
        return { docId: d.id, ...data, lote: data.lote || 1 } as Order;
      }).filter(o => o.lote === loteFilter && !(o as any).deleted && !(o as any).excluido);

      // Ordenação por data (desc) em memória
      filteredOrders.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      // Paginação manual
      let startIndex = 0;
      if (lastVisible) {
        startIndex = filteredOrders.findIndex(o => o.docId === lastVisible.id) + 1;
        if (startIndex === 0) startIndex = 0; // Se não encontrado, começa do início
      }

      const paginatedOrders = filteredOrders.slice(startIndex, startIndex + ORDERS_PAGE_SIZE);
      
      // Identifica o DocumentSnapshot para a próxima página
      const lastItem = paginatedOrders[paginatedOrders.length - 1];
      const hasMore = (startIndex + ORDERS_PAGE_SIZE < filteredOrders.length);
      const lastVisibleDoc = (hasMore && lastItem) ? snap.docs.find(d => d.id === lastItem.docId) || null : null;

      return { orders: paginatedOrders, lastVisible: lastVisibleDoc as any };
    }

    // Se o filtro for 'Todos' ou undefined, usamos a busca nativa por data (apenas um índice simples de campo único necessário)
    const constraints: any[] = [
      orderBy("data", "desc"),
      limit(ORDERS_PAGE_SIZE)
    ];

    if (lastVisible) {
      constraints.push(startAfter(lastVisible));
    }

    const q = query(collection(db, "pedidos"), ...constraints);
    const snap = await getDocs(q);
    
    const orders = snap.docs.map(d => {
        const data = d.data();
        return { docId: d.id, ...data, lote: data.lote || 1 } as Order; // Fallback LOTE 1
    }).filter(o => !(o as any).deleted && !(o as any).excluido);
    const lastVisibleDoc = orders.length > 0 && snap.docs.length === ORDERS_PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null;

    return { orders, lastVisible: lastVisibleDoc };
  } catch (e: any) {
    service.handleFirebaseError(e, "Get Paginated Orders");
    return { orders: [], lastVisible: null };
  }
};

/**
 * Busca de pedidos otimizada: Pesquisa apenas em Líder, Setor e Cidade.
 * Implementa normalização de acentos para garantir resultados precisos.
 */
export const searchOrders = async (searchTerm: string): Promise<Order[]> => {
  try {
    await service.connect();
    
    const normalize = (str: string) => (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const term = normalize(searchTerm.trim());
    if (!term) return [];

    const snap = await getDocs(collection(db, "pedidos"));
    const results: Order[] = [];
    
    snap.forEach(d => {
      const data = d.data();
      const order = { docId: d.id, ...data, lote: data.lote || 1 } as Order;
      
      // Regra: Ignorar pedidos marcados como excluídos (soft delete)
      if ((order as any).deleted === true || (order as any).excluido === true) return;
      
      const displaySetor = (order.setor === 'UMADEMATS') 
        ? 'UMADEMATS' 
        : (order.local === 'Capital' && !order.setor.toUpperCase().startsWith('SETOR') 
            ? `SETOR ${order.setor}` 
            : order.setor);

      // Limita a busca exclusivamente a LÍDER, SETOR e CIDADE
      const searchableFields = [
        order.nome,
        order.setor,
        displaySetor
      ].map(normalize);

      const isMatch = searchableFields.some(f => f.includes(term));

      if (isMatch) {
        results.push(order);
      }
    });

    return results.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  } catch (e: any) {
    service.handleFirebaseError(e, "Search Orders");
    return [];
  }
};

export const getOrderById = async (orderId: string): Promise<Order | null> => {
  try {
    await service.connect();
    const orderRef = doc(db, "pedidos", orderId);
    const orderSnap = await getDoc(orderRef);
    if (orderSnap.exists()) {
        const data = orderSnap.data();
      return { docId: orderSnap.id, ...data, lote: data.lote || 1 } as Order; // Fallback LOTE 1
    }
    return null;
  } catch (e: any) {
    service.handleFirebaseError(e, "Get Order By ID");
    return null;
  }
};

export const deleteOrder = async (order: Order) => {
  try {
    await service.connect();
    const success = await runTransaction(db, async (transaction) => {
      const orderRef = doc(db, "pedidos", order.docId);
      const paymentDocId = getPaymentDocId(order);
      const paymentLogRef = doc(db, "pagamentos", paymentDocId);

      const paymentLogSnap = await transaction.get(paymentLogRef);
      if (paymentLogSnap.exists()) {
          const allLiquidacoes = paymentLogSnap.data().liquidacoes || [];
          const updatedLiquidacoes = allLiquidacoes.filter((p: any) => p.pedidoId !== order.docId);
          transaction.update(paymentLogRef, { liquidacoes: updatedLiquidacoes });
      }
      
      transaction.delete(orderRef);

      return true;
    });

    if (success) {
      syncAllStats(); 
    }
    return success;
  } catch (e: any) { service.handleFirebaseError(e, "Delete Order"); return false; }
};

export const checkExistingEmail = async (email: string, currentBatch: number) => {
  try {
    await service.connect();
    const q = query(
        collection(db, "pedidos"), 
        where("email", "==", email.toLowerCase().trim())
    );
    const snap = await getDocs(q);

    const duplicate = snap.docs.find(d => {
        const data = d.data();
        const recordBatch = data.lote || 1; // Fallback LOTE 1
        return recordBatch === currentBatch;
    });

    return { exists: !!duplicate, message: duplicate ? `Já existe um pedido registrado com este e-mail no Lote ${currentBatch}.` : "" };
  } catch (e: any) { 
    console.warn("Falha ao checar e-mail duplicado.");
    return { exists: false, message: "" };
  }
};

export const checkExistingSector = async (local: 'Capital' | 'Interior', setor: string, currentBatch: number) => {
  try {
    await service.connect();
    const q = query(
        collection(db, "pedidos"), 
        where("local", "==", local), 
        where("setor", "==", setor), 
        limit(10)
    );
    const snap = await getDocs(q);

    const duplicate = snap.docs.find(d => {
        const data = d.data();
        const recordBatch = data.lote || 1; // Fallback LOTE 1
        return recordBatch === currentBatch;
    });

    let message = "";
    if (duplicate) {
      const displaySetor = (local === 'Capital' && setor !== 'UMADEMATS') ? `SETOR ${setor}` : setor;
      message = local === 'Capital' ? `O ${displaySetor} já possui um pedido registrado no Lote ${currentBatch}.` : `A cidade de ${setor} já possui um pedido registrado no Lote ${currentBatch}.`;
    }

    return { exists: !!duplicate, message };
  } catch (e: any) {
    console.warn("Falha ao checar setor duplicado.");
    return { exists: false, message: "" };
  }
};

export const findOrder = async (id: string) => {
  try {
    await service.connect();
    const q = query(collection(db, "pedidos"), where("numPedido", "==", id.trim().toUpperCase()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return { docId: snap.docs[0].id, ...data, lote: data.lote || 1 } as Order; // Fallback LOTE 1
  } catch (e: any) { service.handleFirebaseError(e, "Find Order"); return null; }
};

export const findOrderByEmail = async (email: string): Promise<Order[]> => {
  try {
    await service.connect();
    const q = query(collection(db, "pedidos"), where("email", "==", email.toLowerCase().trim()));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        return { docId: d.id, ...data, lote: data.lote || 1 } as Order; // Fallback LOTE 1
    }).sort((a, b) => b.lote - a.lote);
  } catch (e: any) { service.handleFirebaseError(e, "Find Order by Email"); return []; }
};

export const updateOrder = async (docId: string, orderData: Partial<Order>) => {
  try {
    await service.connect();
    const success = await runTransaction(db, async (transaction) => {
      const orderRef = doc(db, "pedidos", docId);
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists()) throw new Error("Pedido não encontrado");
      
      const oldOrder = orderSnap.data() as Order;
      const newTotalValue = orderData.valorTotal!;
      const valorPago = oldOrder.valorPago;
      
      let newStatus: 'Pendente' | 'Parcial' | 'Pago' = 'Pendente';
      if (valorPago >= newTotalValue) newStatus = 'Pago';
      else if (valorPago > 0) newStatus = 'Parcial';

      transaction.update(orderRef, { ...orderData, statusPagamento: newStatus });

      return true;
    });

    if (success) {
      syncAllStats();
    }
    return success;
  } catch (e: any) { 
    service.handleFirebaseError(e, "Update Order"); 
    return false; 
  }
};

export const updateOrderComment = async (docId: string, comentario: string) => {
  try {
    await service.connect();
    const orderRef = doc(db, "pedidos", docId);
    await updateDoc(orderRef, { comentario });
    return true;
  } catch (e: any) {
    service.handleFirebaseError(e, "Update Order Comment");
    return false;
  }
};

export const createOrder = async (orderData: Partial<Order>, prefix: string = 'PED') => {
  try {
    await service.connect();
    
    const config = await getGlobalConfig();
    const currentBatch = config.currentBatch;

    const numPedido = await runTransaction(db, async (transaction) => {
      const orderRef = doc(collection(db, "pedidos"));
      const randomPart = Math.random().toString(36).substr(2, 6).toUpperCase();
      const numPedido = `${prefix}-${randomPart}`;
      
      transaction.set(orderRef, {
        ...orderData,
        numPedido,
        data: new Date().toISOString(),
        statusPagamento: 'Pendente',
        valorPago: 0,
        lote: currentBatch
      });

      return numPedido;
    });

    if (numPedido) {
      syncAllStats().catch(err => console.warn("Erro silencioso ao sincronizar:", err));
    }
    return numPedido;
  } catch (e: any) { 
    service.handleFirebaseError(e, "Create Order"); 
  }
};
