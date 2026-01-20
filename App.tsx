import React, { useState, useEffect, useCallback } from 'react';
import { Section, Stats, Order } from './types';
import { getStats, auth, connectFirebase, signOutUser, getGlobalConfig, isFirebaseReady } from './services/firebase';
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
import { SplashScreen } from './components/SplashScreen';
import { PdfActionModal } from './components/PdfActionModal';

type ConnectionState = 'connecting' | 'connected' | 'error' | 'api-disabled' | 'rules-denied' | 'auth-disabled';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>(Section.Home);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [showSplash, setShowSplash] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showSizeMatrix, setShowSizeMatrix] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(true);
  const [pdfToAction, setPdfToAction] = useState<{ doc: any, filename: string } | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      if (!isFirebaseReady()) return;
      const config = await getGlobalConfig();
      setIsOrdersOpen(config.pedidosAbertos);
    } catch (e) {
      console.warn("Configurações básicas não puderam ser carregadas.");
    }
  }, []);

  const initFirebase = useCallback(async () => {
    try {
      await connectFirebase();
      await loadConfig();
      setConnection('connected');
    } catch (e: any) {
      console.error("Firebase Init Error:", e);
      if (e.message === "API_DISABLED") setConnection('api-disabled');
      else if (e.message === "RULES_DENIED") setConnection('rules-denied');
      else if (e.message === "AUTH_DISABLED") setConnection('auth-disabled');
      else {
        // Falha de rede ou timeout, tentamos prosseguir como 'connected' mas alertamos no console
        setConnection('connected');
      }
    }
  }, [loadConfig]);

  useEffect(() => {
    initFirebase();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && isFirebaseReady()) {
        try {
          const isAdminUser = !user.isAnonymous && user.email === 'admin@umademats.com.br';
          setIsAdmin(isAdminUser);
          
          // Só carregamos estatísticas se for Admin ou se as regras forem relaxadas para leitura pública
          const s = await getStats();
          setStats(s);
        } catch (e: any) {
          // Ignoramos erros de permissão silenciosamente para usuários anônimos
          if (!e.message.includes("permission-denied")) {
             console.error("Auth status change error:", e);
          }
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
    return <SplashScreen loading={connection === 'connecting'} onAccess={() => setShowSplash(false)} />;
  }

  const renderErrorState = () => {
    const errorConfig = {
      'api-disabled': {
        title: "API Cloud Firestore Desativada",
        desc: "O banco de dados Firestore está bloqueado no console do Google Cloud. Isso é comum em novos projetos.",
        checklist: [
          "Vá ao Console Google Cloud",
          "Ative 'Cloud Firestore API' e 'Firebase Management API'",
          "Confirme se há uma conta de faturamento (Billing) ativa"
        ],
        guide: null
      },
      'rules-denied': {
        title: "BLOQUEIO DE REGRAS (PERMISSÃO)",
        desc: "As Regras de Segurança do seu Firebase estão impedindo o acesso. Você precisa substituir o código das Regras no Console do Firebase.",
        checklist: [
          "Acesse: Firebase Console > Firestore Database > Rules",
          "Substitua TODO o código atual pelo bloco abaixo",
          "Clique no botão azul 'PUBLISH' (Publicar)"
        ],
        guide: (
          <div className="mt-8">
            <div className="bg-slate-900 rounded-3xl p-8 border-2 border-red-500/30 relative group">
              <div className="absolute top-4 right-4 text-red-500/40 font-black text-[9px] uppercase tracking-widest">COPIAR ESTE CÓDIGO</div>
              <pre className="text-[12px] md:text-sm text-sky-400 font-mono leading-relaxed select-all overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
              </pre>
            </div>
            <p className="mt-4 text-[10px] text-center text-text-secondary font-bold uppercase tracking-widest italic">
              * Nota: Após clicar em Publicar, o erro pode levar até 1 minuto para desaparecer.
            </p>
          </div>
        )
      },
      'auth-disabled': {
        title: "Login Anônimo Desativado",
        desc: "O aplicativo precisa da Autenticação Anônima ativa no Firebase.",
        checklist: [
          "Vá em Firebase Console > Authentication",
          "Aba 'Sign-in method' > Clique em 'Add new provider'",
          "Escolha 'Anonymous' (Anônimo) e clique em ATIVAR"
        ],
        guide: null
      },
      'error': {
        title: "Erro de Comunicação",
        desc: errorDetails || "Não foi possível conectar ao servidor. Verifique sua conexão.",
        checklist: ["Confirme o projectId no Firebase", "Verifique o sinal da internet", "Recarregue a página"],
        guide: null
      }
    };

    const currentError = errorConfig[connection as keyof typeof errorConfig] || errorConfig['error'];

    return (
      <div className="max-w-3xl mx-auto mb-10 p-8 md:p-14 card border-l-8 border-red-500 bg-red-500/5 animate-in slide-in-from-top-4 duration-700">
        <div className="flex flex-col gap-10">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 rounded-[2rem] bg-red-500/20 flex items-center justify-center text-4xl text-red-500 shrink-0 shadow-2xl shadow-red-500/20">
              <i className="fas fa-user-shield"></i>
            </div>
            <div>
              <h3 className="text-3xl font-black text-text-primary uppercase tracking-tighter leading-none">{currentError.title}</h3>
              <div className="flex items-center gap-3 mt-4">
                 <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                 <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.2em]">Resolução Obrigatória</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-8">
            <p className="text-base md:text-lg text-text-secondary leading-relaxed font-bold border-b border-border-light pb-8">
              {currentError.desc}
            </p>
            
            <div className="bg-white rounded-[2.5rem] p-10 border-2 border-red-500/10 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full -mr-16 -mt-16"></div>
              
              <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500 mb-6 flex items-center gap-3">
                <i className="fas fa-list-check"></i>
                Guia Definitivo de Correção:
              </p>
              
              <ul className="space-y-6 relative z-10">
                {currentError.checklist.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-4 text-sm md:text-base text-text-primary font-black">
                    <div className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center text-[12px] shrink-0 mt-0.5 shadow-lg shadow-red-500/30">
                      {idx + 1}
                    </div>
                    <span className="pt-1">{item}</span>
                  </li>
                ))}
              </ul>

              {currentError.guide}
            </div>

            <Button className="w-full h-16 text-sm rounded-[2rem] shadow-2xl" onClick={() => window.location.reload()}>
              <i className="fas fa-rotate mr-2"></i> RECARREGAR APÓS CORRIGIR
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-20 bg-background selection:bg-primary selection:text-white">
      <Header 
        isAdmin={isAdmin} 
        onAdminClick={() => handleNavigation(Section.Admin)} 
        onLogout={handleLogout}
        isAtAdminPanel={activeSection === Section.Admin}
      />
      
      {showSizeMatrix ? (
        <main className="container mx-auto px-4 sm:px-6 pt-28 animate-in fade-in duration-700">
          <SizeMatrix onClose={() => setShowSizeMatrix(false)} />
        </main>
      ) : (
        <main className="container mx-auto px-4 sm:px-6 pt-28 animate-in fade-in duration-700">
          {connection !== 'connected' && connection !== 'connecting' ? renderErrorState() : (
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
                {activeSection === Section.Admin && <AdminPanel stats={stats} onEditOrder={handleEdit} onShowSizeMatrix={() => setShowSizeMatrix(true)} />}
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