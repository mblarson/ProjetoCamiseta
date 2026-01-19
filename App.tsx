
import React, { useState, useEffect, useCallback } from 'react';
import { Section, Stats, Order } from './types';
import { getStats, auth, connectFirebase, signOutUser, getGlobalConfig } from './services/firebase';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// Components
import { Header } from './components/Header';
import { HomeMenu } from './components/HomeMenu';
import { OrderSection } from './components/OrderSection';
import { ConsultSection } from './components/ConsultSection';
import { AdminPanel } from './components/AdminPanel';
import { LoginModal } from './components/LoginModal';
import { SizeMatrix } from './components/SizeMatrix';
import { SplashScreen } from './components/SplashScreen';
import { PdfActionModal } from './components/PdfActionModal';
import { ConnectionStatus } from './components/ConnectionStatus';

type ConnectionState = 'connecting' | 'connected' | 'error' | 'api-disabled' | 'permission-denied';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>(Section.Home);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [showSplash, setShowSplash] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  
  // Alterado para armazenar o número do lote selecionado para a matriz
  const [selectedMatrixBatch, setSelectedMatrixBatch] = useState<number | null>(null);
  const [isOrdersOpen, setIsOrdersOpen] = useState(true);
  
  const [pdfToAction, setPdfToAction] = useState<{ doc: any, filename: string } | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const config = await getGlobalConfig();
      setIsOrdersOpen(config.pedidosAbertos);
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  }, []);

  const initFirebase = useCallback(async () => {
    try {
      await connectFirebase();
      await loadConfig();
      setConnection('connected');
    } catch (e: any) {
      console.error("Firebase Auth Error:", e);
      if (e.message === "API_DISABLED") {
        setConnection('api-disabled');
      } else if (e.message === "PERMISSION_DENIED") {
        setConnection('permission-denied');
      } else {
        setConnection('error');
        setErrorDetails(e.message);
      }
    }
  }, [loadConfig]);

  useEffect(() => {
    initFirebase();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const isAdminUser = !user.isAnonymous && user.email === 'admin@umademats.com.br';
        setIsAdmin(isAdminUser);

        try {
          const s = await getStats();
          setStats(s);
        } catch (e: any) {
          console.warn("Stats access restricted:", e.message);
        }
      }
    });

    return () => unsubscribe();
  }, [initFirebase]);

  useEffect(() => {
    const handler = (e: any) => setPdfToAction(e.detail);
    window.addEventListener('show-pdf-modal', handler);
    return () => window.removeEventListener('show-pdf-modal', handler);
  }, []);
  
  const handleLogout = async () => {
    await signOutUser();
    setIsAdmin(false);
    setStats(null);
    setActiveSection(Section.Home);
    loadConfig();
  };

  const handleNavigation = (section: Section) => {
    if (section === Section.Order) {
      if (!isOrdersOpen && !isAdmin) return;
      setEditingOrder(null);
      setActiveSection(Section.Order);
    } else if (section === Section.Admin) {
      if (isAdmin) {
        setActiveSection(Section.Admin);
      } else {
        setIsLoginModalOpen(true);
      }
    } else {
      setActiveSection(section);
    }
  };

  const handleEdit = (order: Order) => {
    if (!isOrdersOpen && !isAdmin) {
      alert("O período de edição foi encerrado.");
      return;
    }
    setEditingOrder(order);
    setActiveSection(Section.Order);
  };

  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false);
    setActiveSection(Section.Admin);
    loadConfig();
  };

  if (showSplash) {
    return <SplashScreen loading={connection !== 'connected'} onAccess={() => setShowSplash(false)} />;
  }

  return (
    <div className="min-h-screen pb-20 bg-background selection:bg-primary selection:text-white">
      <Header 
        isAdmin={isAdmin} 
        onAdminClick={() => handleNavigation(Section.Admin)} 
        onLogout={handleLogout}
        isAtAdminPanel={activeSection === Section.Admin}
      />
      
      {selectedMatrixBatch !== null ? (
        <main className="container mx-auto px-4 sm:px-6 pt-28 animate-in fade-in duration-700">
          <SizeMatrix 
            batchNumber={selectedMatrixBatch} 
            onClose={() => setSelectedMatrixBatch(null)} 
          />
        </main>
      ) : (
        <main className="container mx-auto px-4 sm:px-6 pt-28 animate-in fade-in duration-700">
          <ConnectionStatus connection={connection} errorDetails={errorDetails} />

          {connection === 'connected' && (
            <div className="animate-in fade-in duration-500">
              {activeSection !== Section.Home && (
                <button 
                  onClick={() => {
                    if (isAdmin && activeSection === Section.Admin) {
                        handleLogout();
                    } else {
                        setActiveSection(Section.Home);
                        setEditingOrder(null);
                    }
                  }} 
                  className="mb-8 group flex items-center gap-4 text-text-secondary hover:text-primary transition-all font-black text-[11px] uppercase tracking-[0.2em]"
                >
                  <div className="w-10 h-10 rounded-full border border-border-light flex items-center justify-center group-hover:border-primary/50 transition-colors">
                    <i className="fas fa-arrow-left"></i>
                  </div>
                  Voltar ao Menu Principal
                </button>
              )}

              <div className="transition-all duration-500 ease-out">
                {activeSection === Section.Home && <HomeMenu onNavigate={handleNavigation} isOrdersOpen={isOrdersOpen} />}
                {activeSection === Section.Consult && <ConsultSection onEdit={handleEdit} isOrdersOpen={isOrdersOpen} />}
                {activeSection === Section.Order && <OrderSection initialOrder={editingOrder} onBackToHome={() => setActiveSection(Section.Home)} />}
                {activeSection === Section.Admin && (
                  <AdminPanel 
                    stats={stats} 
                    onEditOrder={handleEdit} 
                    onShowSizeMatrix={(batch) => setSelectedMatrixBatch(batch)} 
                  />
                )}
              </div>
            </div>
          )}
        </main>
      )}

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      <PdfActionModal 
        pdfData={pdfToAction} 
        onClose={() => setPdfToAction(null)} 
      />

      <footer className="mt-32 py-12 border-t border-border-light text-center">
        <p className="text-text-secondary/40 text-[10px] font-bold uppercase tracking-[0.4em]">
          &copy; 2025 UMADEMATS • Jubileu de Ouro
        </p>
      </footer>
    </div>
  );
};

export default App;
