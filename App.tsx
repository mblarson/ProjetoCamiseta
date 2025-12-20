
import React, { useState, useEffect, useCallback } from 'react';
import { Section, Stats, Order } from './types';
import { getStats, auth, connectFirebase, signOutUser } from './services/firebase';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// Components
import { Button } from './components/UI';
import { Header } from './components/Header';
import { HomeMenu } from './components/HomeMenu';
import { OrderSection } from './components/OrderSection';
import { ConsultSection } from './components/ConsultSection';
import { AdminPanel } from './components/AdminPanel';
import { LoginModal } from './components/LoginModal';
import { SizeMatrix } from './components/SizeMatrix';

type ConnectionState = 'connecting' | 'connected' | 'error' | 'api-disabled';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>(Section.Home);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showSizeMatrix, setShowSizeMatrix] = useState(false);

  const initFirebase = useCallback(async () => {
    try {
      await connectFirebase();
    } catch (e: any) {
      console.error("Firebase Auth Error:", e);
      if (e.message === "API_DISABLED") {
        setConnection('api-disabled');
      } else {
        setConnection('error');
        setErrorDetails(e.message);
      }
    }
  }, []);

  useEffect(() => {
    initFirebase();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const s = await getStats();
          setStats(s);
          setConnection('connected');
          setErrorDetails(null);
          const isAdminUser = !user.isAnonymous && user.email === 'admin@umademats.com.br';
          setIsAdmin(isAdminUser);
        } catch (e: any) {
          if (e.message === "API_DISABLED") {
            setConnection('api-disabled');
          } else {
            setConnection('error');
            setErrorDetails(e.message);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [initFirebase]);
  
  const handleLogout = async () => {
    await signOutUser();
    setIsAdmin(false);
    setActiveSection(Section.Home);
  };

  const handleNavigation = (section: Section) => {
    if (section === Section.Order) {
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
    setEditingOrder(order);
    setActiveSection(Section.Order);
  };

  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false);
    setActiveSection(Section.Admin);
  };

  const handleShowSizeMatrix = () => {
    setActiveSection(Section.Admin);
    setShowSizeMatrix(true);
  };

  const handleCloseSizeMatrix = () => {
    setShowSizeMatrix(false);
  };

  return (
    <div className="min-h-screen pb-20 bg-background selection:bg-primary selection:text-[#0A192F]">
      <Header 
        isAdmin={isAdmin} 
        onAdminClick={() => handleNavigation(Section.Admin)} 
        onLogout={handleLogout}
        isAtAdminPanel={activeSection === Section.Admin}
      />
      
      {showSizeMatrix ? (
        <main className="px-4 sm:px-6 pt-24 animate-in fade-in duration-700">
          <SizeMatrix onClose={handleCloseSizeMatrix} />
        </main>
      ) : (
        <main className="container mx-auto px-4 sm:px-6 pt-24 animate-in fade-in duration-700">
          {connection === 'api-disabled' && (
            <div className="max-w-2xl mx-auto mb-10 p-10 card border-l-4 border-red-500 bg-red-500/5 animate-in slide-in-from-top-4">
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center text-2xl text-red-500">
                    <i className="fas fa-plug-circle-exmark"></i>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">API do Cloud Firestore Desativada</h3>
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-[0.2em]">Configuração Obrigatória</p>
                  </div>
                </div>
                <div className="space-y-4 text-sm text-text-secondary">
                  <p>O Google Cloud exige que a API do Firestore seja ativada manualmente para este projeto.</p>
                  <div className="pt-4 flex flex-col sm:flex-row gap-4">
                    <Button className="flex-1 h-14" onClick={() => window.location.reload()}>
                      <i className="fas fa-sync-alt"></i> JÁ ATIVEI, RECARREGAR SISTEMA
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {connection === 'connecting' && (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6"></div>
              <p className="text-primary font-black text-[10px] uppercase tracking-[0.4em]">Sincronizando com Servidor Premium...</p>
            </div>
          )}

          {connection === 'connected' && (
            <div className="animate-in fade-in duration-500">
              {activeSection !== Section.Home && (
                <button 
                  onClick={() => {
                    setActiveSection(Section.Home);
                    setEditingOrder(null);
                  }} 
                  className="mb-6 group flex items-center gap-3 text-text-secondary hover:text-primary transition-all font-black text-[10px] uppercase tracking-[0.2em]"
                >
                  <div className="w-8 h-8 rounded-full border border-border-light flex items-center justify-center group-hover:border-primary/50 transition-colors">
                    <i className="fas fa-arrow-left"></i>
                  </div>
                  Menu Principal
                </button>
              )}

              <div className="transition-all duration-500 ease-out">
                {activeSection === Section.Home && <HomeMenu onNavigate={handleNavigation} />}
                {activeSection === Section.Consult && <ConsultSection onEdit={handleEdit} />}
                {activeSection === Section.Order && <OrderSection initialOrder={editingOrder} onBackToHome={() => setActiveSection(Section.Home)} />}
                {activeSection === Section.Admin && <AdminPanel stats={stats} onEditOrder={handleEdit} onShowSizeMatrix={handleShowSizeMatrix} />}
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

      <footer className="mt-32 py-10 border-t border-border-light text-center">
        <p className="text-text-secondary/60 text-[9px] font-bold uppercase tracking-[0.4em]">
          &copy; 2025 UMADEMATS • Jubileu de Ouro
        </p>
      </footer>
    </div>
  );
};

export default App;
