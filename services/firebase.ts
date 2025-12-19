
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
  getFirestore, initializeFirestore, collection, getDocs, query, where, 
  doc, getDoc, setDoc, runTransaction, increment, limit, Firestore, updateDoc, orderBy, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getAuth, signInAnonymously, Auth, User } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { Order, Stats, PaymentHistory } from '../types';

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
    if (msg.includes("Cloud Firestore API has not been used") || code === "permission-denied") {
      throw new Error("API_DISABLED");
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

export interface GlobalConfig {
  pedidosAbertos: boolean;
  valorCamiseta: number;
}

const getPaymentDocId = (order: Pick<Order, 'local' | 'setor'>): string => {
  let key = order.setor.toUpperCase().trim();
  if (order.local === 'Capital' && !key.startsWith('SETOR')) {
    key = `SETOR ${key}`;
  }
  return key;
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
    if (snap.exists()) return snap.data() as GlobalConfig;
  } catch (e: any) { service.handleFirebaseError(e); }
  return { pedidosAbertos: true, valorCamiseta: 30.00 };
};

export const updateGlobalConfig = async (data: Partial<GlobalConfig>) => {
  try {
    await service.connect();
    await updateDoc(doc(db, "configuracoes", "geral"), data);
    return true;
  } catch (e: any) { 
    try {
      await setDoc(doc(db, "configuracoes", "geral"), { pedidosAbertos: true, valorCamiseta: 30.00, ...data }, { merge: true });
      return true;
    } catch (inner) {
      service.handleFirebaseError(e); 
      return false;
    }
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
        nomeLider: orderData.nome
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
          total_recebido_real: increment(amount)
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
      
      if (!paymentLogSnap.exists()) {
        throw new Error("Registro de pagamentos do setor não encontrado.");
      }

      const allLiquidacoes = paymentLogSnap.data().liquidacoes || [];
      const orderPayments = allLiquidacoes
        .filter((p: any) => p.pedidoId === orderId)
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (orderPayments.length === 0) {
        console.warn("Attempted to cancel payment on an order with no payment history in the payments collection.");
        return false;
      }
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
    console.error("🔥 Error within cancelLastPayment transaction:", e);
    return false;
  }
};

export const endEvent = async () => {
  try {
    await service.connect();
    const ordersSnap = await getDocs(collection(db, "pedidos"));
    const paymentsSnap = await getDocs(collection(db, "pagamentos"));
    const batch = writeBatch(db);
    
    ordersSnap.docs.forEach(d => batch.delete(d.ref));
    paymentsSnap.docs.forEach(d => batch.delete(d.ref));
    
    batch.set(doc(db, "configuracoes", "estatisticas"), {
      qtd_pedidos: 0,
      qtd_camisetas: 0,
      valor_total: 0,
      total_recebido_real: 0,
      qtd_infantil: 0,
      qtd_babylook: 0,
      qtd_unissex: 0,
      pedidos_pagos: 0,
      pedidos_pendentes: 0,
      pedidos_parciais: 0
    });

    await batch.commit();
    return true;
  } catch (e: any) { service.handleFirebaseError(e); return false; }
};

export const getStats = async (): Promise<Stats> => {
  try {
    await service.connect();
    const snap = await getDoc(doc(db, "configuracoes", "estatisticas"));
    if (snap.exists()) return snap.data() as Stats;
  } catch (e: any) { service.handleFirebaseError(e); }
  return { qtd_pedidos: 0, qtd_camisetas: 0, valor_total: 0, total_recebido_real: 0, qtd_infantil: 0, qtd_babylook: 0, qtd_unissex: 0, pedidos_pagos: 0, pedidos_pendentes: 0, pedidos_parciais: 0 } as Stats;
};

export const getAllOrders = async (): Promise<Order[]> => {
  try {
    await service.connect();
    const q = query(collection(db, "pedidos"), orderBy("data", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ docId: d.id, ...d.data() } as Order));
  } catch (e: any) { service.handleFirebaseError(e); return []; }
};

export const getOrderById = async (orderId: string): Promise<Order | null> => {
  try {
    await service.connect();
    const orderRef = doc(db, "pedidos", orderId);
    const orderSnap = await getDoc(orderRef);
    if (orderSnap.exists()) {
      return { docId: orderSnap.id, ...orderSnap.data() } as Order;
    }
    return null;
  } catch (e: any) {
    service.handleFirebaseError(e);
    return null;
  }
};

const calculateShirtCount = (order: Order) => {
  let count = 0;
  const countColor = (data?: any) => {
    if (!data) return;
    Object.values(data).forEach((cat: any) => {
      Object.values(cat).forEach((q: any) => count += (q || 0));
    });
  };
  countColor(order.verdeOliva);
  countColor(order.terracota);
  return count;
};

export const deleteOrder = async (order: Order) => {
  try {
    await service.connect();
    return await runTransaction(db, async (transaction) => {
      const statsRef = doc(db, "configuracoes", "estatisticas");
      const orderRef = doc(db, "pedidos", order.docId);
      const paymentDocId = getPaymentDocId(order);
      const paymentLogRef = doc(db, "pagamentos", paymentDocId);
      
      const statsSnap = await transaction.get(statsRef);
      if (statsSnap.exists()) {
        const update: any = {
          qtd_pedidos: increment(-1),
          qtd_camisetas: increment(-calculateShirtCount(order)),
          valor_total: increment(-order.valorTotal),
          total_recebido_real: increment(-(order.valorPago || 0))
        };
        
        if (order.statusPagamento === 'Pago') update.pedidos_pagos = increment(-1);
        else if (order.statusPagamento === 'Parcial') update.pedidos_parciais = increment(-1);
        else update.pedidos_pendentes = increment(-1);

        transaction.update(statsRef, update);
      }

      const paymentLogSnap = await transaction.get(paymentLogRef);
      if (paymentLogSnap.exists()) {
          const allLiquidacoes = paymentLogSnap.data().liquidacoes || [];
          const updatedLiquidacoes = allLiquidacoes.filter((p: any) => p.pedidoId !== order.docId);
          transaction.update(paymentLogRef, { liquidacoes: updatedLiquidacoes });
      }
      
      transaction.delete(orderRef);
      return true;
    });
  } catch (e: any) { service.handleFirebaseError(e); return false; }
};

export const checkExistingOrder = async (email: string) => {
  try {
    await service.connect();
    const q = query(collection(db, "pedidos"), where("email", "==", email.toLowerCase().trim()), limit(1));
    const snap = await getDocs(q);
    return { exists: !snap.empty, message: !snap.empty ? "Já existe um pedido com este e-mail." : "" };
  } catch (e: any) { service.handleFirebaseError(e); return { exists: false }; }
};

export const findOrder = async (id: string) => {
  try {
    await service.connect();
    const q = query(collection(db, "pedidos"), where("numPedido", "==", id.trim().toUpperCase()), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : { docId: snap.docs[0].id, ...snap.docs[0].data() } as Order;
  } catch (e: any) { service.handleFirebaseError(e); return null; }
};

export const findOrderByEmail = async (email: string) => {
  try {
    await service.connect();
    const q = query(collection(db, "pedidos"), where("email", "==", email.toLowerCase().trim()), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : { docId: snap.docs[0].id, ...snap.docs[0].data() } as Order;
  } catch (e: any) { service.handleFirebaseError(e); return null; }
};

export const updateOrder = async (docId: string, orderData: Partial<Order>) => {
  try {
    await service.connect();
    const docRef = doc(db, "pedidos", docId);
    await updateDoc(docRef, orderData);
    return true;
  } catch (e: any) { service.handleFirebaseError(e); return false; }
};

export const createOrder = async (orderData: Partial<Order>, prefix: string = 'PED') => {
  try {
    await service.connect();
    return await runTransaction(db, async (transaction) => {
      const statsRef = doc(db, "configuracoes", "estatisticas");
      const statsSnap = await transaction.get(statsRef);
      
      if (!statsSnap.exists()) {
        transaction.set(statsRef, { qtd_pedidos: 0, qtd_camisetas: 0, valor_total: 0, total_recebido_real: 0, qtd_infantil: 0, qtd_babylook: 0, qtd_unissex: 0, pedidos_pagos: 0, pedidos_pendentes: 0, pedidos_parciais: 0 });
      }

      const orderRef = doc(collection(db, "pedidos"));
      const randomPart = Math.random().toString(36).substr(2, 6).toUpperCase();
      const numPedido = `${prefix}-${randomPart}`;
      
      transaction.set(orderRef, {
        ...orderData,
        numPedido,
        data: new Date().toISOString(),
        statusPagamento: 'Pendente',
        valorPago: 0
      });

      transaction.update(statsRef, { qtd_pedidos: increment(1), pedidos_pendentes: increment(1) });
      return numPedido;
    });
  } catch (e: any) { service.handleFirebaseError(e); }
}
