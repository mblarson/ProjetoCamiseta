import React, { useState, useEffect } from 'react';
import { Modal, Input, Button } from './UI';
import { signInWithEmail } from '../services/firebase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const email = "admin@umademats.com.br";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signInWithEmail(email, password);
      if (result.success) {
        onSuccess();
      } else {
        const invalidCredentialCodes = [
          'auth/wrong-password', 
          'auth/user-not-found', 
          'auth/invalid-credential',
          'auth/invalid-login-credentials'
        ];
        if (result.code && invalidCredentialCodes.includes(result.code)) {
          setError('Credenciais inválidas. Verifique a senha e tente novamente.');
        } else {
          setError('Ocorreu um erro durante o login. Tente novamente mais tarde.');
        }
      }
    } catch (err) {
      setError('Erro de conexão. Verifique sua internet.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setError('');
      setIsLoading(false);
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Acesso Administrativo">
      <form onSubmit={handleLogin} className="space-y-6">
        <Input 
          label="Usuário" 
          type="email" 
          value={email} 
          disabled
        />
        <Input 
          label="Senha de Acesso" 
          type="text" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
          autoFocus 
          className="text-center"
        />
        
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-bold text-center animate-shake">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full h-14" disabled={isLoading}>
          {isLoading ? <i className="fas fa-circle-notch fa-spin"></i> : "ENTRAR"}
        </Button>
      </form>
    </Modal>
  );
};