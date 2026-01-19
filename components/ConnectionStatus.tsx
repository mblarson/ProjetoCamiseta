
import React from 'react';
import { Button } from './UI';

type ConnectionState = 'connecting' | 'connected' | 'error' | 'api-disabled' | 'permission-denied';

interface ConnectionStatusProps {
  connection: ConnectionState;
  errorDetails: string | null;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ connection, errorDetails }) => {
  if (connection === 'connected' || connection === 'connecting') return null;

  return (
    <div className="max-w-2xl mx-auto mb-10 p-10 card border-l-4 animate-in slide-in-from-top-4 transition-all duration-500" 
         style={{ borderColor: connection === 'permission-denied' ? '#f97316' : '#ef4444', backgroundColor: connection === 'permission-denied' ? 'rgba(249, 115, 22, 0.05)' : 'rgba(239, 68, 68, 0.05)' }}>
      
      {connection === 'api-disabled' && (
        <div className="flex flex-col gap-6 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center text-2xl text-red-500">
              <i className="fas fa-plug-circle-exmark"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-text-primary uppercase tracking-tight leading-tight">API do Cloud Firestore Desativada</h3>
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-[0.2em]">Configuração Obrigatória</p>
            </div>
          </div>
          <div className="space-y-4 text-sm text-text-secondary">
            <p>O Google Cloud exige que a API do Firestore seja ativada manualmente no console do projeto.</p>
            <Button className="w-full h-14" onClick={() => window.location.reload()}>RECARREGAR SISTEMA</Button>
          </div>
        </div>
      )}

      {connection === 'permission-denied' && (
        <div className="flex flex-col gap-6 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center text-2xl text-orange-500">
              <i className="fas fa-user-shield"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-text-primary uppercase tracking-tight leading-tight">Acesso ao Banco Negado</h3>
              <p className="text-[10px] text-orange-500 font-bold uppercase tracking-[0.2em]">Erro de Permissão</p>
            </div>
          </div>
          <div className="space-y-4 text-sm text-text-secondary">
            <p>A API está ativada, mas as <b>Regras de Segurança (Rules)</b> do Firestore estão bloqueando o acesso.</p>
            <p className="p-4 bg-background rounded-xl border border-border-light text-[11px] font-mono leading-relaxed">
              Acesse o Console do Firebase &gt; Firestore &gt; Aba "Rules" e certifique-se de que a leitura e escrita estão permitidas.
            </p>
            <Button className="w-full h-14" onClick={() => window.location.reload()}>TENTAR NOVAMENTE</Button>
          </div>
        </div>
      )}

      {connection === 'error' && (
        <div className="flex flex-col gap-4 text-center">
          <h3 className="text-xl font-black text-red-500 mb-2 uppercase tracking-tighter">ERRO DE CONEXÃO CRÍTICO</h3>
          <p className="text-sm text-text-secondary mb-4 leading-relaxed">{errorDetails || "Ocorreu um problema inesperado ao conectar com o banco de dados."}</p>
          <Button className="w-full h-14" onClick={() => window.location.reload()}>TENTAR NOVAMENTE</Button>
        </div>
      )}
    </div>
  );
};
