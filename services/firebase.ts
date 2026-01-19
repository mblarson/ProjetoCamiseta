
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
  getFirestore, initializeFirestore, collection, getDocs, query, where, 
  doc, getDoc, setDoc, runTransaction, increment, limit, Firestore, updateDoc, orderBy, deleteDoc, writeBatch,
  DocumentSnapshot, startAfter, documentId
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getAuth, signInAnonymously, Auth, User, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { Order, Stats, PaymentHistory, ColorData, Confirmation } from '../types';

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

  private constructor() {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      this.db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        useFetchStreams: false
      });
      this.auth = getAuth(app);
    } catch (e) {
      console.error("🔥 Firebase: Falha na Configuração Inicial", e);
      throw e;
    }
  }

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  public handleFirebaseError(e: any) {
    const msg = e.message || "";
    const code = e.code || "";
    
    // Distinguir erro de API desativada de erro de permissão (Regras de Segurança)
    if (msg.includes("Cloud Firestore API has not been used")) {
      throw new Error("API_DISABLED");
    }
    
    if (code === "permission-denied") {
      throw new Error("PERMISSION_DENIED");
    }
    
    throw e;
  }

  public async connect(): Promise<User> {
    if (this.auth.currentUser) return this.auth.currentUser;
    if (this.authPromise) return this.authPromise;
    this.authPromise = signInAnonymously(this.auth).then(cred => cred.user).catch(err => {
      this.authPromise = null;
      this.handleFirebaseError(err);
      throw err;
    });
    return this.authPromise;
  }
}

const service = FirebaseService.getInstance();
export const auth = service.auth;
export const db = service.db;
export const connectFirebase = () => service.connect();

export const signInWithEmail = async (email, password) => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        return { success: true };
    } catch (error: any) {
        console.error("Firebase Auth Error:", error.code);
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

const getConfirmationDocId = (local: 'Capital' | 'Interior', setor: string, lote: number = 1): string => {
  let baseId = setor.toUpperCase().trim();
  if (baseId === 'UMADEMATS') baseId = 'UMADEMATS';
  else if (local === 'Capital') baseId = `SETOR ${baseId}`;
  
  if (lote > 1) {
    return `LOTE_${lote}_${baseId}`;
  }
  return baseId;
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

    const batches: Record<number, { qtd_pedidos: number, qtd_camisetas: number, valor_total: number }> = {};

    ordersSnap.forEach(doc => {
      const data = doc.data() as Order;
      const lote = data.lote || 1;

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

      if (data.statusPagamento === 'Pago') pagos++;
      else if (data.statusPagamento === 'Parcial') parciais++;
      else pendentes++;
    });

    const statsRef = doc(db, "configuracoes", "estatisticas");
    await setDoc(statsRef, {
      qtd_pedidos: totalPedidos,
      qtd_camisetas: totalCamisetas,
      valor_total: totalPrevisto,
      total_recebido_real: totalRecebido,
      pedidos_pagos: pagos,
      pedidos_parciais: parciais,
      pedidos_pendentes: pendentes,
      batches: batches,
      qtd_infantil: 0,
      qtd_babylook: 0,
      qtd_unissex: 0
    }, { merge: true });

    return true;
  } catch (e: any) {
    service.handleFirebaseError(e);
    return false;
  }
};

export const fetchFullBackup = async () => {
  try {
    await service.connect();
    const [ordersSnap, paymentsSnap, confirmationsSnap, statsSnap, configSnap] = await Promise.all([
      getDocs(collection(db, "pedidos")),
      getDocs(collection(db, "pagamentos")),
      getDocs(collection(db, "confirmacoes")),
      getDoc(doc(db, "configuracoes", "estatisticas")),
      getDoc(doc(db, "configuracoes", "geral"))
    ]);

    return {
      backupDate: new Date().toISOString(),
      evento: "UMADEMATS - JUBILEU DE OURO",
      config: configSnap.data(),
      pedidos: ordersSnap.docs.map(d => ({ docId: d.id, ...d.data() })),
      pagamentos: paymentsSnap.docs.map(d => ({ docId: d.id, ...d.data() })),
      confirmacoes: confirmationsSnap.docs.map(d => ({ docId: d.id, ...d.data() })),
      estatisticasFinal: statsSnap.exists() ? statsSnap.data() : null
    };
  } catch (e: any) {
    console.error("Erro ao gerar backup:", e);
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
    service.handleFirebaseError(e);
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
      service.handleFirebaseError(e);
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
  } catch (e: any) { service.handleFirebaseError(e); }
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
      service.handleFirebaseError(e);
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
        service.handleFirebaseError(e);
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
        
        const confQuery = query(collection(db, "confirmacoes"), where("lote", "==", batchToDelete));
        const confSnap = await getDocs(confQuery);

        const batch = writeBatch(db);

        ordersSnap.forEach(d => batch.delete(d.ref));
        confSnap.forEach(d => batch.delete(d.ref));
        
        const configRef = doc(db, "configuracoes", "geral");
        batch.update(configRef, { currentBatch: batchToDelete - 1 });

        await batch.commit();
        await syncAllStats();
        return true;
    } catch (e: any) {
        service.handleFirebaseError(e);
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

      const timestamp = new Date().toISOString();
      const liquidacaoId = `${orderId}-${timestamp}`;

      const historyEntry: PaymentHistory = {
        valor: amount,
        data: date || new Date().toLocaleDateString('pt-BR'),
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
  } catch (e: any) { service.handleFirebaseError(e); return false; }
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
    
    const [ordersSnap, paymentsSnap, confirmationsSnap] = await Promise.all([
      getDocs(collection(db, "pedidos")),
      getDocs(collection(db, "pagamentos")),
      getDocs(collection(db, "confirmacoes"))
    ]);

    const allDocs = [
      ...ordersSnap.docs,
      ...paymentsSnap.docs,
      ...confirmationsSnap.docs
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
    console.error("Erro ao encerrar evento:", e);
    service.handleFirebaseError(e); 
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
    service.handleFirebaseError(e); 
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
        return { docId: d.id, ...data, lote: data.lote || 1 } as Order;
    });
  } catch (e: any) { service.handleFirebaseError(e); return []; }
};

const ORDERS_PAGE_SIZE = 50;

export const getPaginatedOrders = async (lastVisible?: DocumentSnapshot, loteFilter?: number): Promise<{ orders: Order[], lastVisible: DocumentSnapshot | null }> => {
  try {
    await service.connect();
    const constraints: any[] = [
      orderBy("data", "desc"),
      limit(ORDERS_PAGE_SIZE)
    ];

    if (loteFilter) {
        constraints.unshift(where("lote", "==", loteFilter));
    }

    if (lastVisible) {
      constraints.push(startAfter(lastVisible));
    }

    const q = query(collection(db, "pedidos"), ...constraints);
    const snap = await getDocs(q);
    
    const orders = snap.docs.map(d => {
        const data = d.data();
        return { docId: d.id, ...data, lote: data.lote || 1 } as Order;
    });
    const lastVisibleDoc = snap.docs.length === ORDERS_PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null;

    return { orders, lastVisible: lastVisibleDoc };
  } catch (e: any) {
    service.handleFirebaseError(e);
    return { orders: [], lastVisible: null };
  }
};

export const searchOrders = async (searchTerm: string): Promise<Order[]> => {
  try {
    await service.connect();
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];

    const snap = await getDocs(collection(db, "pedidos"));
    const results: Order[] = [];
    
    snap.forEach(d => {
      const data = d.data();
      const order = { docId: d.id, ...data, lote: data.lote || 1 } as Order;
      
      const displaySetor = (order.setor === 'UMADEMATS') 
        ? 'UMADEMATS' 
        : (order.local === 'Capital' && !order.setor.toUpperCase().startsWith('SETOR') 
            ? `SETOR ${order.setor}` 
            : order.setor);

      const searchableFields = [
        order.numPedido,
        order.nome,
        order.setor,
        displaySetor,
        order.local,
        order.email,
        order.contato
      ].map(f => (f || "").toLowerCase());

      const isMatch = searchableFields.some(f => f.includes(term));

      if (isMatch) {
        results.push(order);
      }
    });

    return results.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  } catch (e: any) {
    service.handleFirebaseError(e);
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
      return { docId: orderSnap.id, ...data, lote: data.lote || 1 } as Order;
    }
    return null;
  } catch (e: any) {
    service.handleFirebaseError(e);
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

      const confDocId = getConfirmationDocId(order.local, order.setor, order.lote);
      const confRef = doc(db, "confirmacoes", confDocId);
      transaction.delete(confRef);

      return true;
    });

    if (success) {
      await syncAllStats();
    }
    return success;
  } catch (e: any) { service.handleFirebaseError(e); return false; }
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
        const recordBatch = data.lote || 1;
        return recordBatch === currentBatch;
    });

    return { exists: !!duplicate, message: duplicate ? `Já existe um pedido registrado com este e-mail no Lote ${currentBatch}.` : "" };
  } catch (e: any) { 
    service.handleFirebaseError(e); 
    return { exists: false, message: "Erro ao verificar o e-mail." };
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
        const recordBatch = data.lote || 1;
        return recordBatch === currentBatch;
    });

    let message = "";
    if (duplicate) {
      const displaySetor = (local === 'Capital' && setor !== 'UMADEMATS') ? `SETOR ${setor}` : setor;
      message = local === 'Capital' ? `O ${displaySetor} já possui um pedido registrado no Lote ${currentBatch}.` : `A cidade de ${setor} já possui um pedido registrado no Lote ${currentBatch}.`;
    }

    return { exists: !!duplicate, message };
  } catch (e: any) {
    service.handleFirebaseError(e);
    return { exists: false, message: "Erro ao verificar o setor/cidade." };
  }
};

export const findOrder = async (id: string) => {
  try {
    await service.connect();
    const q = query(collection(db, "pedidos"), where("numPedido", "==", id.trim().toUpperCase()), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return { docId: snap.docs[0].id, ...data, lote: data.lote || 1 } as Order;
  } catch (e: any) { service.handleFirebaseError(e); return null; }
};

export const findOrderByEmail = async (email: string): Promise<Order[]> => {
  try {
    await service.connect();
    const q = query(collection(db, "pedidos"), where("email", "==", email.toLowerCase().trim()));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        return { docId: d.id, ...data, lote: data.lote || 1 } as Order;
    }).sort((a, b) => b.lote - a.lote);
  } catch (e: any) { service.handleFirebaseError(e); return []; }
};

export const updateOrder = async (docId: string, orderData: Partial<Order>) => {
  try {
    await service.connect();
    const success = await runTransaction(db, async (transaction) => {
      const orderRef = doc(db, "pedidos", docId);
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists()) throw new Error("Pedido não encontrado");
      
      const oldOrder = orderSnap.data() as Order;
      const lote = oldOrder.lote || 1;
      const newTotalValue = orderData.valorTotal!;
      const valorPago = oldOrder.valorPago;
      
      let newStatus: 'Pendente' | 'Parcial' | 'Pago' = 'Pendente';
      if (valorPago >= newTotalValue) newStatus = 'Pago';
      else if (valorPago > 0) newStatus = 'Parcial';

      transaction.update(orderRef, { ...orderData, statusPagamento: newStatus });

      const oldConfId = getConfirmationDocId(oldOrder.local, oldOrder.setor, lote);
      const newConfId = orderData.local && orderData.setor 
        ? getConfirmationDocId(orderData.local, orderData.setor, lote) 
        : oldConfId;

      if (oldConfId !== newConfId) {
        transaction.delete(doc(db, "confirmacoes", oldConfId));
        transaction.set(doc(db, "confirmacoes", newConfId), {
          type: orderData.local || oldOrder.local,
          status: 'none',
          lastUpdated: '',
          lote: lote
        }, { merge: true });
      }

      return true;
    });

    if (success) {
      await syncAllStats();
    }
    return success;
  } catch (e: any) { 
    service.handleFirebaseError(e); 
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

      if (orderData.local && orderData.setor) {
        const confDocId = getConfirmationDocId(orderData.local, orderData.setor, currentBatch);
        const confRef = doc(db, "confirmacoes", confDocId);
        transaction.set(confRef, {
          type: orderData.local,
          status: 'none',
          lastUpdated: '',
          lote: currentBatch
        }, { merge: true });
      }

      return numPedido;
    });

    if (numPedido) {
      await syncAllStats();
    }
    return numPedido;
  } catch (e: any) { service.handleFirebaseError(e); }
};

export const getConfirmations = async (loteFilter?: number): Promise<Confirmation[]> => {
  try {
    await service.connect();
    let q;
    if (loteFilter) {
        q = query(collection(db, "confirmacoes"), where("lote", "==", loteFilter));
    } else {
        q = query(collection(db, "confirmacoes"));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        return { docId: d.id, ...data, lote: data.lote || 1 } as Confirmation;
    });
  } catch (e: any) {
    service.handleFirebaseError(e);
    return [];
  }
};

export const searchConfirmations = async (searchTerm: string): Promise<Confirmation[]> => {
  try {
    await service.connect();
    const term = searchTerm.trim().toUpperCase();
    const q = query(collection(db, "confirmacoes"), orderBy(documentId()), where(documentId(), ">=", term), where(documentId(), "<=", term + '\uf8ff'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        return { docId: d.id, ...data, lote: data.lote || 1 } as Confirmation;
    });
  } catch (e: any) {
      service.handleFirebaseError(e);
      return [];
  }
};

export const syncConfirmationsFromOrders = async () => {
  try {
    await service.connect();
    const [orders, confirmations] = await Promise.all([
      getAllOrders(),
      getConfirmations()
    ]);

    const existingIds = new Set(confirmations.map(c => c.docId));
    const newConfirmationsMap = new Map<string, Omit<Confirmation, 'docId'>>();

    orders.forEach(order => {
      const lote = order.lote || 1;
      const docId = getConfirmationDocId(order.local, order.setor, lote);
      
      if (!existingIds.has(docId) && !newConfirmationsMap.has(docId)) {
        newConfirmationsMap.set(docId, {
          type: order.local,
          status: 'none',
          lastUpdated: '',
          lote: lote
        });
      }
    });

    if (newConfirmationsMap.size > 0) {
      const batch = writeBatch(db);
      newConfirmationsMap.forEach((data, docId) => {
        const docRef = doc(db, "confirmacoes", docId);
        batch.set(docRef, data);
      });
      await batch.commit();
    }
    return true;
  } catch (e: any) {
    service.handleFirebaseError(e);
    return false;
  }
};

export const updateConfirmationStatus = async (docId: string, status: 'none' | 'confirmed' | 'pending') => {
  try {
    await service.connect();
    const docRef = doc(db, "confirmacoes", docId);
    await updateDoc(docRef, {
      status: status,
      lastUpdated: new Date().toISOString()
    });
    return true;
  } catch (e: any) {
    service.handleFirebaseError(e);
    return false;
  }
};
