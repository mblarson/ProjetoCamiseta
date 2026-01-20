
import React, { useState, useMemo, useEffect } from 'react';
import { Button, Input, Card, Modal, TextArea } from './UI';
import { checkExistingEmail, checkExistingSector, createOrder, updateOrder, getGlobalConfig } from '../services/firebase';
import { SETORES_CAPITAL, INFANTIL_SIZES, BABYLOOK_SIZES, UNISSEX_SIZES, DEFAULT_PRICE } from '../constants';
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

// Componente auxiliar para a tabela de revisão no resumo
const OrderReviewTable: React.FC<{ title: string, data: ColorData, colorHex: string }> = ({ title, data, colorHex }) => {
    const items: { category: string, size: string, quantity: number }[] = [];
    (['infantil', 'babylook', 'unissex'] as const).forEach(category => {
        const categoryData = data[category];
        if (categoryData) {
            Object.entries(categoryData).forEach(([size, quantity]) => {
                const q = quantity as number;
                if (q > 0) {
                    items.push({ category, size, quantity: q });
                }
            });
        }
    });

    if (items.length === 0) return null;

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <h4 className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-text-primary">
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: colorHex }}></div>
                {title}
            </h4>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-[11px] border-t border-border-light pt-3">
                <div className="font-bold text-text-secondary uppercase tracking-wider">Categoria</div>
                <div className="font-bold text-text-secondary uppercase tracking-wider text-center">Tam.</div>
                <div className="font-bold text-text-secondary uppercase tracking-wider text-right">Qtd.</div>
                {items.map((item, index) => (
                    <React.Fragment key={index}>
                        <div className="text-text-secondary font-medium capitalize">{item.category}</div>
                        <div className="text-text-primary font-bold text-center">{item.size}</div>
                        <div className="text-text-primary font-black text-right">{item.quantity}</div>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export const OrderSection: React.FC<OrderSectionProps> = ({ onBackToHome, initialOrder }) => {
  const [step, setStep] = useState<OrderStep>(initialOrder ? 'sizes' : 'info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [unitPrice, setUnitPrice] = useState(DEFAULT_PRICE);
  const [currentBatch, setCurrentBatch] = useState(1);
  
  const [info, setInfo] = useState({ 
    nome: '', local: 'Capital' as 'Capital' | 'Interior', 
    setor: '', email: '', contato: '', observacao: '' 
  });
  
  const [verdeOliva, setVerdeOliva] = useState<ColorData>(initialColorData());
  const [terracota, setTerracota] = useState<ColorData>(initialColorData());
  const [activeColor, setActiveColor] = useState<ColorType>('verdeOliva');

  useEffect(() => {
    getGlobalConfig().then(c => {
        setUnitPrice(c.valorCamiseta);
        setCurrentBatch(c.currentBatch);
    });
    
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
      setValidationError(null);
      if (!initialOrder) {
        setIsSubmitting(true);
        try {
          const sectorResult = await checkExistingSector(info.local, info.setor, currentBatch);
          if (sectorResult.exists) {
            setValidationError(sectorResult.message);
            setIsSubmitting(false);
            return;
          }
          const emailResult = await checkExistingEmail(info.email, currentBatch);
          if (emailResult.exists) {
            setValidationError(emailResult.message);
            setIsSubmitting(false);
            return;
          }
        } catch (err: any) {
          setErrorMsg("Erro de conexão ao validar dados.");
          setIsSubmitting(false);
          return;
        }
      }
      setStep('sizes');
      setIsSubmitting(false);
    }
  };

  const finalizeOrder = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      // Remove observacao do payload para garantir que não seja enviada/sobrescrita
      const { observacao: _, ...cleanInfo } = info;
      const orderData = {
        ...cleanInfo,
        verdeOliva,
        terracota,
        valorTotal: totals.preco 
      };
      
      let resId = '';
      if (initialOrder) {
        await updateOrder(initialOrder.docId, orderData);
        resId = initialOrder.numPedido;
      } else {
        const numPedido = await createOrder(orderData);
        if (!numPedido) throw new Error("Falha ao gerar número do pedido.");
        resId = numPedido;
      }
      
      setOrderId(resId);
      setIsConfirmModalOpen(false);
      setStep('success');
    } catch (e) {
      console.error("Erro no envio:", e);
      setErrorMsg("Falha ao salvar pedido. Verifique sua conexão.");
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const formatSetorDisplay = () => {
    if (info.setor === 'UMADEMATS') return 'UMADEMATS';
    return info.local === 'Capital' && !info.setor.startsWith('SETOR') 
      ? `SETOR ${info.setor}` 
      : info.setor;
  };

  if (step === 'success') {
    return (
      <div className="max-w-md mx-auto text-center py-10 animate-in zoom-in-95">
        <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-check text-2xl"></i>
        </div>
        <h2 className="text-2xl font-black mb-1 text-text-primary">{initialOrder ? "Pedido Atualizado!" : "Pedido Realizado!"}</h2>
        <p className="text-[9px] text-primary/50 uppercase tracking-[0.2em] font-bold mb-6">Código de acompanhamento:</p>
        <div className="card p-5 mb-10 border-2 border-primary/20">
          <span className="text-3xl font-black text-text-primary tracking-widest">{orderId}</span>
        </div>
        <Button onClick={() => onBackToHome ? onBackToHome() : window.location.reload()} variant="outline" className="h-12 text-[10px] w-full">VOLTAR AO INÍCIO</Button>
      </div>
    );
  }

  return (
    <div className={`max-w-5xl mx-auto ${step === 'sizes' ? 'pb-48 sm:pb-72' : 'pb-20'}`}>
      <div className="flex items-center mb-12 relative px-4">
        <div className="absolute top-5 sm:top-6 left-0 w-full h-px bg-border-light -z-10"></div>
        <StepIndicator num={1} active={step === 'info'} done={step !== 'info'} label="Identificação" />
        <StepIndicator num={2} active={step === 'sizes'} done={step === 'summary'} label="Tamanhos" />
        <StepIndicator num={3} active={step === 'summary'} done={false} label="Resumo" />
      </div>

      {step === 'info' && (
        <form onSubmit={handleNextStep} className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-8">
          <div className="md:col-span-2 flex justify-end">
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border border-primary/20">
                Lote Atual: {currentBatch}
              </span>
          </div>
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
              <select required className="bg-background border-2 border-border-light rounded-2xl px-5 py-4 text-text-primary focus:outline-none focus:border-primary transition-all font-bold h-[62px]" value={info.setor} onChange={e => setInfo({...info, setor: e.target.value})}>
                <option value="">-- Selecione --</option>
                {SETORES_CAPITAL.map(s => <option key={s} value={s}>{s === 'UMADEMATS' ? s : `SETOR ${s}`}</option>)}
              </select>
            </div>
          ) : <Input label="Cidade" required value={info.setor} onChange={e => setInfo({...info, setor: e.target.value})} />}
          <Input label="E-mail" type="email" required value={info.email} onChange={e => setInfo({...info, email: e.target.value})} />
          <Input label="WhatsApp" required value={info.contato} onChange={e => setInfo({...info, contato: maskPhone(e.target.value)})} />
          
          <div className="md:col-span-2 flex justify-center pt-6">
            <Button type="submit" className="min-w-[300px] h-14" disabled={isSubmitting}>AVANÇAR PARA TAMANHOS</Button>
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
            <SizeGrid title="Babylook (Feminina)" sizes={BABYLOOK_SIZES} data={activeColor === 'verdeOliva' ? verdeOliva.babylook : terracota.babylook} onChange={(sz, val) => (activeColor === 'verdeOliva' ? setVerdeOliva : setTerracota)(prev => ({ ...prev, babylook: { ...prev.babylook, [sz]: val } }))} />
            <SizeGrid title="Unissex" sizes={UNISSEX_SIZES} data={activeColor === 'verdeOliva' ? verdeOliva.unissex : terracota.unissex} onChange={(sz, val) => (activeColor === 'verdeOliva' ? setVerdeOliva : setTerracota)(prev => ({ ...prev, unissex: { ...prev.unissex, [sz]: val } }))} />
          </div>
          <div className="fixed bottom-0 inset-x-0 bg-surface/90 backdrop-blur-xl p-4 sm:p-8 z-[200] border-t border-border-light shadow-2xl">
            <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex flex-col items-center sm:items-start">
                <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Valor Total</span>
                <span className="text-3xl sm:text-4xl font-black text-text-primary tracking-tighter">{totals.preco.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
              </div>
              <div className="flex gap-4 w-full sm:w-auto">
                <Button variant="outline" className="flex-1 h-14 px-8" onClick={() => setStep('info')}>VOLTAR</Button>
                <Button className="flex-2 h-14 px-12" onClick={() => setStep('summary')} disabled={totals.total === 0}>RESUMO DO PEDIDO</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'summary' && (
        <div className="max-w-3xl mx-auto animate-in zoom-in-95 duration-500 pb-20">
          <Card className="p-8 sm:p-12 border-2 border-primary/10">
            <h3 className="text-2xl font-black mb-10 border-b-2 border-border-light pb-6 text-text-primary flex items-center gap-4">
              <i className="fas fa-file-invoice text-primary opacity-30"></i>
              Resumo do Pedido
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 mb-12">
              <SummaryItem label="Responsável" value={info.nome} />
              <SummaryItem label="Setor / Local" value={`${formatSetorDisplay()} (${info.local})`} />
              <SummaryItem label="E-mail" value={info.email} />
              <SummaryItem label="WhatsApp" value={info.contato} />
            </div>
            
            <div className="space-y-10 my-10 bg-background/50 p-6 rounded-3xl border border-border-light">
                <OrderReviewTable title="Verde Oliva" data={verdeOliva} colorHex="#556B2F" />
                <OrderReviewTable title="Terracota" data={terracota} colorHex="#a35e47" />
            </div>

            {/* SEÇÃO DE OBSERVAÇÃO PRESERVADA PARA EXIBIÇÃO DE PEDIDOS ANTIGOS */}
            {info.observacao ? (
              <div className="mb-10 p-6 bg-primary-light/30 border-2 border-primary/10 rounded-[2rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
                <div className="flex items-start gap-4 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm shrink-0">
                    <i className="fas fa-comment-dots"></i>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-2">Observações Adicionais</p>
                    <p className="text-sm text-text-primary font-medium leading-relaxed italic">
                      "{info.observacao}"
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="pt-8 border-t-2 border-border-light flex flex-col sm:flex-row justify-between items-center gap-6">
               <div className="text-center sm:text-left">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary block mb-1">Total Final</span>
                  <span className="text-4xl font-black text-text-primary tracking-tighter">{totals.preco.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
               </div>
               <div className="flex gap-4 w-full sm:w-auto">
                 <Button variant="outline" className="flex-1 sm:px-8 h-14" onClick={() => setStep('sizes')}>VOLTAR</Button>
                 <Button className="flex-2 sm:px-12 h-14" onClick={() => setIsConfirmModalOpen(true)}>CONFIRMAR</Button>
               </div>
            </div>
          </Card>
        </div>
      )}

      <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="Confirmar Pedido">
        <div className="space-y-6 text-center">
          <p className="text-sm text-text-secondary font-bold uppercase tracking-wider mb-6">Ao confirmar, o pedido será enviado para o sistema central da UMADEMATS.</p>
          <Button className="w-full h-14" onClick={finalizeOrder} disabled={isSubmitting}>
            {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : "ENVIAR PEDIDO AGORA"}
          </Button>
          {errorMsg && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-xs text-red-500 font-bold uppercase tracking-widest">{errorMsg}</p>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={!!validationError} onClose={() => setValidationError(null)} title="Ação Bloqueada">
        <div className="text-center space-y-6">
            <p className="text-base text-text-secondary font-bold">{validationError}</p>
            <Button onClick={() => setValidationError(null)} className="w-full h-12">ENTENDI</Button>
        </div>
      </Modal>
    </div>
  );
};

const SummaryItem: React.FC<{ label: string, value: string }> = ({ label, value }) => (
  <div className="space-y-1">
    <p className="text-[10px] text-primary font-black uppercase tracking-widest opacity-60">{label}</p>
    <p className="font-black text-text-primary text-lg truncate" title={value}>{value}</p>
  </div>
);

const StepIndicator: React.FC<{ num: number, active: boolean, done: boolean, label: string }> = ({ num, active, done, label }) => (
  <div className="flex-1 flex flex-col items-center gap-3 relative z-10 bg-background px-2">
    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-black transition-all ${done ? 'bg-primary/80 text-white' : active ? 'bg-primary text-white shadow-xl scale-110' : 'bg-surface border-2 border-border-light text-primary/30'}`}>
      {done ? <i className="fas fa-check"></i> : num}
    </div>
    <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-center ${active ? 'text-primary' : 'text-text-secondary/40'}`}>{label}</span>
  </div>
);

const LocOption: React.FC<{ label: string, checked: boolean, onClick: () => void }> = ({ label, checked, onClick }) => (
  <div onClick={onClick} className={`flex-1 card p-4 rounded-2xl flex items-center justify-center gap-4 cursor-pointer transition-all border-2 ${checked ? 'border-primary bg-primary/5 text-primary' : 'border-transparent hover:border-border-light text-text-secondary'}`}>
    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${checked ? 'border-primary' : 'border-border-light'}`}>
      {checked && <div className="w-2 h-2 rounded-full bg-primary animate-in zoom-in"></div>}
    </div>
    <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
  </div>
);

const ColorTab: React.FC<{ color: ColorType, active: boolean, label: string, onClick: () => void }> = ({ color, active, label, onClick }) => (
  <button onClick={onClick} className={`px-6 py-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${active ? 'border-primary bg-primary/10 shadow-lg text-text-primary' : 'border-border-light bg-surface text-text-secondary hover:border-primary/50'}`}>
    <div className={`w-5 h-5 rounded-lg shadow-sm ${color === 'verdeOliva' ? 'bg-[#3b4a3c]' : 'bg-[#a35e47]'}`}></div>
    <span className="font-black text-xs uppercase tracking-widest">{label}</span>
  </button>
);

const SizeGrid: React.FC<{ title: string, sizes: string[], data: SizeQuantities, onChange: (sz: string, val: number) => void }> = ({ title, sizes, data, onChange }) => (
  <div className="card p-8 sm:p-10 border-2 border-border-light/50">
    <h4 className="text-sm sm:text-lg font-black uppercase tracking-[0.2em] text-primary mb-8 flex items-center gap-4">
      <div className="w-2 h-6 bg-primary rounded-full"></div> {title}
    </h4>
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-4 sm:gap-6 items-end">
      {sizes.map(sz => (
        <div key={sz} className="flex flex-col gap-2">
          <span className="text-[10px] sm:text-xs font-black text-center text-text-secondary/60 uppercase tracking-widest leading-tight min-h-[2.5rem] flex items-center justify-center px-1">
            {sz}
          </span>
          <input 
            type="text" pattern="[0-9]*" inputMode="numeric" placeholder="0" 
            className="w-full bg-background border-2 border-border-light rounded-xl p-3 text-center font-black focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-text-primary placeholder:text-text-secondary/20 text-xl h-14" 
            value={data[sz] || ''} 
            onChange={e => onChange(sz, parseInt(e.target.value.replace(/\D/g, '')) || 0)} 
          />
        </div>
      ))}
    </div>
  </div>
);
