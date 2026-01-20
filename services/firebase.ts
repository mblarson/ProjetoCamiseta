
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { 
  getFirestore, initializeFirestore, collection, getDocs, query, where, 
  doc, getDoc, setDoc, runTransaction, increment, limit, Firestore, updateDoc, orderBy, deleteDoc, writeBatch,
  DocumentSnapshot, startAfter, documentId
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getAuth, signInAnonymously, Auth, User, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
// Added GlobalConfig to imports
import { Order, Stats, PaymentHistory, ColorData, Confirmation, GlobalConfig } from '../types';

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

/**
 * Função Robusta para Contagem de Camisetas
 * Considera nova estrutura (cores) e estrutura legada (raiz)
 */
export const calculateShirtCount = (order: any): number => {
  if (!order) return 0;
  let total = 0;
  const categories = ['infantil', 'babylook', 'unissex'];
  const colors = ['verdeOliva', 'terracota'];

  // 1. Contagem na nova estrutura de Cores
  colors.forEach(col => {
    if (order[col]) {
      categories.forEach(cat => {
        if (order[col][cat]) {
          Object.values(order[col][cat]).forEach(val => {
            total += (Number(val) || 0);
          });
        }
      });
    }
  });

  // 2. Contagem na estrutura Legada (caso exista pedido antigo no lote)
  categories.forEach(cat => {
    if (order[cat]) {
      Object.values(order[cat]).forEach(val => {
        total += (Number(val) || 0);
      });
    }
  });

  return total;
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
      // Reset de campos específicos se necessário futuramente
      qtd_infantil: 0, 
      qtd_babylook: 0,
      qtd_unissex: 0
    }, { merge: true });

    return true;
  } catch (e: any) {
    console.warn("SyncAllStats: Falha na atualização (comum se não for Admin)", e.message);
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
        const confDocId = `LOTE_${currentBatch}_${orderData.setor.toUpperCase().trim()}`;
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
      // Tentativa de sync em background (vai falhar para o cliente, o que é esperado)
      syncAllStats().catch(() => {});
    }
    return numPedido;
  } catch (e: any) { 
    service.handleFirebaseError(e); 
    return null;
  }
};

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
    } catch (error) { console.error(error); }
};
export const getGlobalConfig = async (): Promise<GlobalConfig> => {
  try {
    await service.connect();
    const snap = await getDoc(doc(db, "configuracoes", "geral"));
    if (snap.exists()) return snap.data() as GlobalConfig;
  } catch (e: any) { }
  return { pedidosAbertos: true, valorCamiseta: 30.00, currentBatch: 1 };
};
export const updateGlobalConfig = async (data: Partial<GlobalConfig>) => {
  try {
    await service.connect();
    await setDoc(doc(db, "configuracoes", "geral"), data, { merge: true });
    return true;
  } catch (e) { return false; }
};
export const getStats = async (): Promise<Stats> => {
  // Define default stats that comply with the Stats interface
  const defaultStats: Stats = { 
    qtd_pedidos: 0, 
    qtd_camisetas: 0, 
    valor_total: 0, 
    total_recebido_real: 0, 
    pedidos_pagos: 0, 
    pedidos_pendentes: 0, 
    pedidos_parciais: 0, 
    batches: {},
    qtd_infantil: 0,
    qtd_babylook: 0,
    qtd_unissex: 0
  };
  try {
    await service.connect();
    const snap = await getDoc(doc(db, "configuracoes", "estatisticas"));
    return snap.exists() ? snap.data() as Stats : defaultStats;
  } catch (e) { 
    return defaultStats;
  }
};
export const getAllOrders = async (): Promise<Order[]> => {
  const q = query(collection(db, "pedidos"), orderBy("data", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ docId: d.id, ...d.data() } as Order));
};
export const getPaginatedOrders = async (lastVisible?: DocumentSnapshot) => {
  let q = query(collection(db, "pedidos"), orderBy("data", "desc"), limit(50));
  if (lastVisible) q = query(collection(db, "pedidos"), orderBy("data", "desc"), startAfter(lastVisible), limit(50));
  const snap = await getDocs(q);
  return { orders: snap.docs.map(d => ({ docId: d.id, ...d.data() } as Order)), lastVisible: snap.docs[snap.docs.length - 1] };
};
export const findOrder = async (id: string) => {
  const q = query(collection(db, "pedidos"), where("numPedido", "==", id), limit(1));
  const snap = await getDocs(q);
  return !snap.empty ? { docId: snap.docs[0].id, ...snap.docs[0].data() } as Order : null;
};
export const findOrderByEmail = async (email: string) => {
  const q = query(collection(db, "pedidos"), where("email", "==", email));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ docId: d.id, ...d.data() } as Order));
};
export const deleteOrder = async (order: Order) => {
  try {
    await deleteDoc(doc(db, "pedidos", order.docId));
    await syncAllStats();
    return true;
  } catch (e) { return false; }
};
export const recordPayment = async (orderId: string, amount: number, date: string) => {
  try {
    const orderRef = doc(db, "pedidos", orderId);
    const snap = await getDoc(orderRef);
    const order = snap.data() as Order;
    const newPaid = (order.valorPago || 0) + amount;
    const status = newPaid >= order.valorTotal ? 'Pago' : 'Parcial';
    const history = order.historicoPagamentos || [];
    history.push({ valor: amount, data: date, timestamp: new Date().toISOString(), liquidacaoId: Date.now().toString() });
    
    await updateDoc(orderRef, { valorPago: newPaid, statusPagamento: status, historicoPagamentos: history });
    await syncAllStats();
    return true;
  } catch (e) { return false; }
};
export const cancelLastPayment = async (orderId: string) => {
  try {
    const orderRef = doc(db, "pedidos", orderId);
    const snap = await getDoc(orderRef);
    const order = snap.data() as Order;
    if (!order.historicoPagamentos || order.historicoPagamentos.length === 0) return false;
    const last = order.historicoPagamentos.pop()!;
    const newPaid = order.valorPago - last.valor;
    const status = newPaid <= 0 ? 'Pendente' : (newPaid >= order.valorTotal ? 'Pago' : 'Parcial');
    await updateDoc(orderRef, { valorPago: newPaid, statusPagamento: status, historicoPagamentos: order.historicoPagamentos });
    await syncAllStats();
    return true;
  } catch (e) { return false; }
};
export const getOrderById = async (id: string) => {
  const snap = await getDoc(doc(db, "pedidos", id));
  return snap.exists() ? { docId: snap.id, ...snap.data() } as Order : null;
};
export const getPaymentHistoryForOrder = async (order: Order) => order.historicoPagamentos || [];
export const updateOrder = async (id: string, data: any) => {
  try {
    await updateDoc(doc(db, "pedidos", id), data);
    await syncAllStats();
    return true;
  } catch (e) { return false; }
};
export const checkExistingEmail = async (email: string, batch: number) => {
  const q = query(collection(db, "pedidos"), where("email", "==", email), where("lote", "==", batch), limit(1));
  const snap = await getDocs(q);
  return { exists: !snap.empty, message: !snap.empty ? "E-mail já cadastrado neste lote." : "" };
};
export const checkExistingSector = async (local: string, setor: string, batch: number) => {
  if (setor === 'UMADEMATS') return { exists: false, message: "" };
  const q = query(collection(db, "pedidos"), where("local", "==", local), where("setor", "==", setor), where("lote", "==", batch), limit(1));
  const snap = await getDocs(q);
  return { exists: !snap.empty, message: !snap.empty ? "Setor já possui um pedido neste lote." : "" };
};
export const getConfirmations = async () => {
  const snap = await getDocs(collection(db, "confirmacoes"));
  return snap.docs.map(d => ({ docId: d.id, ...d.data() } as Confirmation));
};
export const searchConfirmations = async (term: string) => {
  const all = await getConfirmations();
  return all.filter(c => c.docId.includes(term.toUpperCase()));
};
export const syncConfirmationsFromOrders = async () => {
  const orders = await getAllOrders();
  const batch = writeBatch(db);
  orders.forEach(o => {
    const id = `LOTE_${o.lote || 1}_${o.setor.toUpperCase().trim()}`;
    batch.set(doc(db, "confirmacoes", id), { type: o.local, status: 'none', lastUpdated: '', lote: o.lote || 1 }, { merge: true });
  });
  await batch.commit();
  return true;
};
export const updateConfirmationStatus = async (id: string, status: string) => {
  await updateDoc(doc(db, "confirmacoes", id), { status, lastUpdated: new Date().toISOString() });
  return true;
};
export const searchOrders = async (term: string) => {
  const all = await getAllOrders();
  const t = term.toUpperCase();
  return all.filter(o => o.numPedido.includes(t) || o.nome.toUpperCase().includes(t) || o.setor.toUpperCase().includes(t));
};
export const createNewBatch = async (num: number) => {
  await updateGlobalConfig({ currentBatch: num });
  return true;
};
export const deleteLastBatch = async () => {
  const config = await getGlobalConfig();
  if (config.currentBatch <= 1) return false;
  await updateGlobalConfig({ currentBatch: config.currentBatch - 1 });
  return true;
};
export const fetchFullBackup = async () => {
  const orders = await getAllOrders();
  const stats = await getStats();
  return { orders, stats, date: new Date().toISOString() };
};
export const endEvent = async () => {
  const orders = await getDocs(collection(db, "pedidos"));
  const batch = writeBatch(db);
  orders.forEach(d => batch.delete(d.ref));
  await batch.commit();
  await syncAllStats();
  return true;
};
