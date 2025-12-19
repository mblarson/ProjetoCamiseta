
import React, { useState, useMemo, useEffect } from 'react';
import { Button, Input, Card, Modal } from './UI';
import { checkExistingOrder, createOrder, updateOrder, getGlobalConfig } from '../services/firebase';
import { SETORES_CAPITAL, INFANTIL_SIZES, ADULTO_SIZES, DEFAULT_PRICE } from '../constants';
import { ColorType, CategoryType, SizeQuantities, ColorData, Order } from '../types';

type OrderStep = 'info' | 'sizes' | 'summary' | 'success';

interface OrderSectionProps {
  onBackToHome?: () => void;
  initialOrder?: Order | null;
}

const initialColorData = (): ColorData => ({
  infantil: {},
  babylook: {},
  unissex: {}
});

export const OrderSection: React.FC<OrderSectionProps> = ({ onBackToHome, initialOrder }) => {
  const [step, setStep] = useState<OrderStep>(initialOrder ? 'sizes' : 'info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [unitPrice, setUnitPrice] = useState(DEFAULT_PRICE);
  
  // Form States
  const [info, setInfo] = useState({ 
    nome: '', local: 'Capital' as 'Capital' | 'Interior', 
    setor: '', email: '', contato: '', observacao: '' 
  });
  
  const [verdeOliva, setVerdeOliva] = useState<ColorData>(initialColorData());
  const [terracota, setTerracota] = useState<ColorData>(initialColorData());
  const [activeColor, setActiveColor] = useState<ColorType>('verdeOliva');

  useEffect(() => {
    getGlobalConfig().then(c => setUnitPrice(c.valorCamiseta));
    
    if (initialOrder) {
      setInfo({
        nome: initialOrder.nome,
        local: initialOrder.local,
        setor: initialOrder.setor,
        email: initialOrder.email,
        contato: initialOrder.contato,
        observacao: initialOrder.observacao || ''
      });
      if (initialOrder.verdeOliva) setVerdeOliva(initialOrder.verdeOliva);
      if (initialOrder.terracota) setTerracota(initialOrder.terracota);
      setStep('sizes');
    }
  }, [initialOrder]);

  const maskPhone = (v: string) => v.replace(/\D/g, "").replace(/^(\d{2})(\d)/g, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").substring(0, 15);

  const totals = useMemo(() => {
    const calculate = (data: ColorData) => {
      let q = 0;
      Object.values(data).forEach(cat => {
        (Object.values(cat) as number[]).forEach(val => q += (val || 0));
      });
      return q;
    };
    const qVerde = calculate(verdeOliva);
    const qTerra = calculate(terracota);
    const totalQtd = qVerde + qTerra;
    return {
      verde: qVerde,
      terra: qTerra,
      total: totalQtd,
      preco: totalQtd * unitPrice
    };
  }, [verdeOliva, terracota, unitPrice]);

  const handleNextStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'info') {
      setErrorMsg('');
      if (!initialOrder) {
          setIsSubmitting(true);
          try {
            const result = await checkExistingOrder(info.email);
            if (result.exists) {
              setErrorMsg(result.message);
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setIsSubmitting(false);
              return;
            }
          } catch (err: any) {
            setErrorMsg("Erro de conexão.");
            setIsSubmitting(false);
            return;
          }
      }
      setStep('sizes');
      setIsSubmitting(false);
    } else if (step === 'sizes') {
      if (totals.total === 0) {
        setErrorMsg("Por favor, selecione ao menos uma camiseta.");
        return;
      }
      setStep('summary');
    }
  };

  const finalizeOrder = async () => {
    setIsSubmitting(true);
    try {
      const orderData = {
        ...info,
        verdeOliva,
        terracota,
        valorTotal: totals.preco 
      };

      if (initialOrder) {
        await updateOrder(initialOrder.docId, orderData);
        setOrderId(initialOrder.numPedido);
      } else {
        const numPedido = await createOrder(orderData);
        setOrderId(numPedido!);
      }
      
      setIsConfirmModalOpen(false);
      setStep('success');
    } catch (e) {
      setErrorMsg("Falha ao salvar pedido.");
    } finally { setIsSubmitting(false); }
  };

  if (step === 'success') {
    return (
      <div className="max-w-md mx-auto text-center py-10 animate-in zoom-in-95">
        <div className="w-12 h-12 bg-green-500/20 text-green-500 rounded-xl flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-check text-xl"></i>
        </div>
        <h2 className="text-xl font-black mb-1 text-text-primary">{initialOrder ? "Pedido Atualizado!" : "Pedido Realizado!"}</h2>
        <p className="text-[9px] text-primary/50 uppercase tracking-[0.2em] font-bold mb-6">Código de acompanhamento:</p>
        <div className="card p-5 mb-10">
          <span className="text-2xl font-black text-text-primary tracking-widest">{orderId}</span>
        </div>
        <div className="flex justify-center w-full">
          <Button 
            onClick={() => onBackToHome ? onBackToHome() : window.location.reload()} 
            variant="outline" 
            className="h-10 text-[8px] px-8"
          >
            VOLTAR AO INÍCIO
          </Button>
        </div>
      </div>
    );
  }

  const formatSetorDisplay = () => {
    return info.local === 'Capital' && !info.setor.startsWith('SETOR') 
      ? `SETOR ${info.setor}` 
      : info.setor;
  };

  return (
    <div className={`max-w-5xl mx-auto ${step === 'sizes' ? 'pb-48 sm:pb-72' : 'pb-20'}`}>
      <div className="flex justify-between items-center mb-8 relative px-4">
        <div className="absolute top-1/2 left-0 w-full h-px bg-border-light -z-10"></div>
        <StepIndicator num={1} active={step === 'info'} done={step !== 'info'} label="Identificação" />
        <StepIndicator num={2} active={step === 'sizes'} done={step === 'summary'} label="Tamanhos" />
        <StepIndicator num={3} active={step === 'summary'} done={false} label="Resumo" />
      </div>

      {errorMsg && (
        <div className="mb-10 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm flex items-center gap-4 animate-shake">
          <i className="fas fa-exclamation-circle text-xl"></i>
          <span className="font-bold uppercase tracking-widest">{errorMsg}</span>
        </div>
      )}

      {step === 'info' && (
        <form onSubmit={handleNextStep} className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in slide-in-from-bottom-8">
          <Input label="Nome Completo do Líder" required value={info.nome} onChange={e => setInfo({...info, nome: e.target.value})} />
          <div className="flex flex-col gap-3">
            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-primary">Localidade</label>
            <div className="flex gap-4">
              <LocOption label="Capital" checked={info.local === 'Capital'} onClick={() => setInfo({...info, local: 'Capital', setor: ''})} />
              <LocOption label="Interior" checked={info.local === 'Interior'} onClick={() => setInfo({...info, local: 'Interior', setor: ''})} />
            </div>
          </div>
          {info.local === 'Capital' ? (
            <div className="flex flex-col gap-3">
              <label className="text-[10px] uppercase font-black tracking-[0.2em] text-primary">Setor</label>
              <select required className="bg-background border border-border-light rounded-xl px-4 py-4 text-text-primary focus:outline-none focus:border-primary transition-all font-bold appearance-none" value={info.setor} onChange={e => setInfo({...info, setor: e.target.value})}>
                <option value="">-- Selecione --</option>
                {SETORES_CAPITAL.map(s => <option key={s} value={s}>SETOR {s}</option>)}
              </select>
            </div>
          ) : <Input label="Cidade" required value={info.setor} onChange={e => setInfo({...info, setor: e.target.value})} />}
          <Input label="E-mail" type="email" required value={info.email} onChange={e => setInfo({...info, email: e.target.value})} />
          <Input label="WhatsApp" required value={info.contato} onChange={e => setInfo({...info, contato: maskPhone(e.target.value)})} />
          <div className="md:col-span-2 flex justify-center pt-8">
            <Button type="submit" className="min-w-[300px] h-14" disabled={isSubmitting}>Avançar para Tamanhos</Button>
          </div>
        </form>
      )}

      {step === 'sizes' && (
        <div className="animate-in fade-in duration-500">
          <div className="flex justify-center gap-6 mb-12">
            <ColorTab color="verdeOliva" active={activeColor === 'verdeOliva'} label="Verde Oliva" onClick={() => setActiveColor('verdeOliva')} />
            <ColorTab color="terracota" active={activeColor === 'terracota'} label="Terracota" onClick={() => setActiveColor('terracota')} />
          </div>
          <div className="space-y-12">
            <SizeGrid title="Infantil" sizes={INFANTIL_SIZES} data={activeColor === 'verdeOliva' ? verdeOliva.infantil : terracota.infantil} onChange={(sz, val) => (activeColor === 'verdeOliva' ? setVerdeOliva : setTerracota)(prev => ({ ...prev, infantil: { ...prev.infantil, [sz]: val } }))} />
            <SizeGrid title="Babylook (Feminina)" sizes={ADULTO_SIZES} data={activeColor === 'verdeOliva' ? verdeOliva.babylook : terracota.babylook} onChange={(sz, val) => (activeColor === 'verdeOliva' ? setVerdeOliva : setTerracota)(prev => ({ ...prev, babylook: { ...prev.babylook, [sz]: val } }))} />
            <SizeGrid title="Unissex (Masculina)" sizes={ADULTO_SIZES} data={activeColor === 'verdeOliva' ? verdeOliva.unissex : terracota.unissex} onChange={(sz, val) => (activeColor === 'verdeOliva' ? setVerdeOliva : setTerracota)(prev => ({ ...prev, unissex: { ...prev.unissex, [sz]: val } }))} />
          </div>
          <div className="fixed bottom-0 inset-x-0 bg-surface p-3 sm:p-7 z-[200] animate-in slide-in-from-bottom-full duration-500 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-border-light">
            <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-10">
              <div className="flex flex-row items-center justify-around sm:justify-start gap-6 sm:gap-14 w-full sm:w-auto text-text-primary">
                <div className="flex flex-col items-center sm:items-start">
                  <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">Valor Total</span>
                  <span className="text-xl sm:text-4xl font-black leading-none tracking-tighter">{totals.preco.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                </div>
              </div>
              <Button className="w-full sm:w-auto h-12 sm:h-16 min-w-[250px] font-black uppercase tracking-[0.2em] text-[10px]" onClick={() => setStep('summary')} disabled={totals.total === 0}>CONTINUAR</Button>
            </div>
          </div>
        </div>
      )}

      {step === 'summary' && (
        <div className="max-w-3xl mx-auto animate-in zoom-in-95 duration-500 pb-20">
          <Card className="p-10">
            <h3 className="text-2xl font-black mb-8 border-b border-border-light pb-4 text-text-primary">Resumo do Pedido</h3>
            <div className="grid grid-cols-2 gap-8 mb-10">
              <div>
                <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1">Responsável</p>
                <p className="font-bold text-text-primary">{info.nome}</p>
              </div>
              <div>
                <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1">Setor / Local</p>
                <p className="font-bold text-text-primary">{formatSetorDisplay()} ({info.local})</p>
              </div>
            </div>
            <div className="pt-4 border-t border-border-light flex justify-between items-center">
               <span className="text-lg font-black uppercase tracking-widest text-primary">Total a Pagar</span>
               <span className="text-3xl font-black text-text-primary">{totals.preco.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-6 mt-8">
              <Button variant="outline" className="flex-1 h-14" onClick={() => setStep('sizes')}>Voltar</Button>
              <Button className="flex-2 h-14" onClick={() => setIsConfirmModalOpen(true)}>Confirmar e Finalizar</Button>
            </div>
          </Card>
        </div>
      )}

      <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="Confirmar Pedido">
        <div className="space-y-6">
          <p className="text-[12px] text-text-secondary font-bold uppercase tracking-[0.2em] mb-4">Deseja realmente finalizar este pedido?</p>
          <Button className="w-full h-14" onClick={finalizeOrder} disabled={isSubmitting}>
            {isSubmitting ? "ENVIANDO..." : "SIM, CONFIRMAR AGORA"}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

const StepIndicator: React.FC<{ num: number, active: boolean, done: boolean, label: string }> = ({ num, active, done, label }) => (
  <div className="flex flex-col items-center gap-3 relative z-10 bg-background px-2">
    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-black transition-all ${done ? 'bg-green-500 text-white' : active ? 'bg-primary text-white shadow-[0_0_20px_rgba(46,125,50,0.4)] scale-110' : 'bg-surface border border-border-light text-primary/50'}`}>
      {done ? <i className="fas fa-check"></i> : num}
    </div>
    <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-center ${active ? 'text-primary' : 'text-text-secondary/50'}`}>{label}</span>
  </div>
);

const LocOption: React.FC<{ label: string, checked: boolean, onClick: () => void }> = ({ label, checked, onClick }) => (
  <div onClick={onClick} className={`flex-1 card p-4 rounded-xl flex items-center justify-center gap-4 cursor-pointer transition-all border-2 ${checked ? 'border-primary bg-primary/5 text-primary' : 'border-transparent hover:border-border-light text-text-secondary'}`}>
    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${checked ? 'border-primary' : 'border-border-light'}`}>
      {checked && <div className="w-2 h-2 rounded-full bg-primary animate-in zoom-in"></div>}
    </div>
    <span className="text-xs font-black uppercase tracking-widest">{label}</span>
  </div>
);

const ColorTab: React.FC<{ color: ColorType, active: boolean, label: string, onClick: () => void }> = ({ color, active, label, onClick }) => (
  <button onClick={onClick} className={`px-4 sm:px-8 py-3 sm:py-4 rounded-2xl border-2 transition-all flex items-center gap-3 sm:gap-4 ${active ? 'border-primary bg-primary/10 shadow-lg text-text-primary' : 'border-border-light bg-surface text-text-secondary hover:border-primary/50'}`}>
    <div className={`w-4 h-4 sm:w-6 sm:h-6 rounded-lg shadow-sm ${color === 'verdeOliva' ? 'bg-[#3b4a3c]' : 'bg-[#a35e47]'}`}></div>
    <span className="font-black text-[10px] sm:text-xs uppercase tracking-widest">{label}</span>
  </button>
);

const SizeGrid: React.FC<{ title: string, sizes: string[], data: SizeQuantities, onChange: (sz: string, val: number) => void }> = ({ title, sizes, data, onChange }) => (
  <div className="card p-6 sm:p-10">
    <h4 className="text-sm sm:text-lg font-black uppercase tracking-[0.2em] text-primary mb-8 flex items-center gap-4">
      <div className="w-2 h-2 rounded-full bg-primary shadow-sm"></div> {title}
    </h4>
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-4 sm:gap-6">
      {sizes.map(sz => (
        <div key={sz} className="flex flex-col gap-2">
          <span className="text-xs sm:text-sm font-black text-center text-text-secondary/60 uppercase tracking-widest">{sz}</span>
          <input type="number" min="0" inputMode="numeric" placeholder="0" className="w-full bg-background border border-border-light rounded-xl p-3 sm:p-4 text-center font-black focus:border-primary transition-all text-text-primary placeholder:text-text-secondary/30 text-lg sm:text-xl h-14 sm:h-16" value={data[sz] || ''} onChange={e => onChange(sz, parseInt(e.target.value) || 0)} />
        </div>
      ))}
    </div>
  </div>
);