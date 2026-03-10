
import React, { useState, useEffect, useMemo } from 'react';
import { Order, UnifiedCity, ColorData } from '../../types';
import { Card, Button } from '../UI';
import { getUnifiedCities, saveUnifiedCity, deleteUnifiedCity } from '../../services/firebase';
import { generateUnifiedCityPDF, generateGeneralUnifiedPDF } from '../../services/pdfService';

interface UnifyCitiesProps {
  orders: Order[];
  onBack: () => void;
}

const getShirtCount = (order: Order) => {
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

export const UnifyCities: React.FC<UnifyCitiesProps> = ({ orders, onBack }) => {
  const [unifiedCities, setUnifiedCities] = useState<UnifiedCity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [excludedCities, setExcludedCities] = useState<Record<string, string[]>>({});
  const [excludeModal, setExcludeModal] = useState<{ show: boolean, prefix: string, city: string, ordersCount: number, otherGroups: string[] } | null>(null);

  const loadUnified = async () => {
    setIsLoading(true);
    const data = await getUnifiedCities();
    setUnifiedCities(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadUnified();
  }, []);

  const suggestions = useMemo(() => {
    const interiorOrders = orders.filter(o => o.local === 'Interior');
    const groups: Record<string, { cities: Set<string>, batchTotals: Record<number, number>, grandTotal: number, totalValue: number }> = {};

    interiorOrders.forEach(order => {
      const originalName = order.setor.trim();
      const prefix = originalName.replace(/\s+/g, '').toLowerCase().substring(0, 7);
      
      if (prefix.length < 3) return; // Ignore very short names

      // Skip if this city was manually excluded from this prefix group
      if (excludedCities[prefix]?.includes(originalName)) return;

      if (!groups[prefix]) {
        groups[prefix] = { cities: new Set(), batchTotals: {}, grandTotal: 0, totalValue: 0 };
      }

      groups[prefix].cities.add(originalName);
      const shirts = getShirtCount(order);
      const lote = order.lote || 1;
      
      groups[prefix].batchTotals[lote] = (groups[prefix].batchTotals[lote] || 0) + shirts;
      groups[prefix].grandTotal += shirts;
      groups[prefix].totalValue += (order.valorTotal || 0);
    });

    return Object.entries(groups)
      .filter(([_, data]) => data.cities.size > 1 || unifiedCities.some(u => u.prefix === _))
      .map(([prefix, data]) => {
        const existing = unifiedCities.find(u => u.prefix === prefix);
        return {
          prefix,
          cities: Array.from(data.cities).sort(),
          batchTotals: data.batchTotals,
          grandTotal: data.grandTotal,
          totalValue: data.totalValue,
          existing
        };
      })
      .sort((a, b) => b.grandTotal - a.grandTotal);
  }, [orders, unifiedCities, excludedCities]);

  const handleExcludeCity = (prefix: string, cityName: string) => {
    const cityOrders = orders.filter(o => o.local === 'Interior' && o.setor.trim() === cityName);
    const ordersCount = cityOrders.reduce((acc, o) => acc + getShirtCount(o), 0);
    
    // Check if this city could potentially fit in other groups (prefixes)
    const normalizedCity = cityName.replace(/\s+/g, '').toLowerCase();
    const otherGroups = suggestions
      .filter(s => s.prefix !== prefix && normalizedCity.startsWith(s.prefix))
      .map(s => s.prefix.toUpperCase());

    setExcludeModal({
      show: true,
      prefix,
      city: cityName,
      ordersCount,
      otherGroups
    });
  };

  const confirmExclude = () => {
    if (!excludeModal) return;
    const { prefix, city } = excludeModal;
    setExcludedCities(prev => ({
      ...prev,
      [prefix]: [...(prev[prefix] || []), city]
    }));
    setExcludeModal(null);
  };

  const handleUnify = async (prefix: string, name: string, cities: string[], batchTotals: Record<number, number>, grandTotal: number, totalValue: number) => {
    setIsSaving(prefix);
    const newUnified: UnifiedCity = {
      name: name.toUpperCase(),
      prefix,
      cities,
      batchTotals,
      grandTotal,
      totalValue,
      createdAt: new Date().toISOString()
    };
    
    const success = await saveUnifiedCity(newUnified);
    if (success) {
      await loadUnified();
    }
    setIsSaving(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja remover esta unificação?")) return;
    const success = await deleteUnifiedCity(id);
    if (success) {
      await loadUnified();
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center animate-pulse">
        <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin mx-auto mb-6"></div>
        <p className="text-primary font-black text-[10px] uppercase tracking-[0.3em] opacity-60">Carregando unificações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-6">
        <button 
          onClick={onBack}
          className="w-12 h-12 rounded-full bg-surface border border-border-light hover:bg-background transition-colors text-text-secondary hover:text-primary flex items-center justify-center"
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <div>
          <h2 className="text-2xl font-black text-text-primary uppercase tracking-tight">Unificar Cidades (Interior)</h2>
          <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mt-1">Agrupamento por prefixo de 7 caracteres</p>
        </div>
        <div className="ml-auto">
          <Button 
            variant="outline"
            className="h-12 px-6 border-primary text-primary hover:bg-primary/5"
            onClick={() => generateGeneralUnifiedPDF(suggestions)}
            disabled={suggestions.length === 0}
          >
            <i className="fas fa-file-pdf mr-2"></i> GERAR PDF GERAL
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {suggestions.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <p className="text-text-secondary font-bold uppercase tracking-widest text-xs">Nenhuma sugestão de unificação encontrada</p>
          </Card>
        ) : (
          suggestions.map(group => (
            <Card key={group.prefix} className={`p-8 border-2 ${group.existing ? 'border-primary/20 bg-primary/5' : 'border-border-light'}`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-lg bg-surface border border-border-light text-[10px] font-black text-text-secondary uppercase tracking-widest">
                      Prefixo: {group.prefix.toUpperCase()}
                    </span>
                    {group.existing && (
                      <span className="px-3 py-1 rounded-lg bg-primary text-[10px] font-black text-white uppercase tracking-widest">
                        Unificado como: {group.existing.name}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {group.cities.map(city => (
                      <div key={city} className="group relative">
                        <span className="px-4 py-2 rounded-xl bg-background border border-border-light text-sm font-bold text-text-primary flex items-center gap-2">
                          {city}
                          {!group.existing && (
                            <button 
                              onClick={() => handleExcludeCity(group.prefix, city)}
                              className="w-5 h-5 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center text-[10px]"
                              title="Remover do agrupamento"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                    {Object.entries(group.batchTotals).sort((a,b) => Number(a[0]) - Number(b[0])).map(([batch, total]) => (
                      <div key={batch} className="p-3 rounded-xl bg-background/50 border border-border-light/50">
                        <p className="text-[8px] font-black text-text-secondary uppercase tracking-widest">Lote {batch}</p>
                        <p className="text-lg font-black text-text-primary tracking-tighter">{total} un.</p>
                      </div>
                    ))}
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                      <p className="text-[8px] font-black text-primary uppercase tracking-widest">Total Geral</p>
                      <p className="text-lg font-black text-primary tracking-tighter">{group.grandTotal} un.</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                  {!group.existing ? (
                    <Button 
                      className="h-14 px-8"
                      disabled={isSaving === group.prefix}
                      onClick={() => handleUnify(group.prefix, group.cities[0], group.cities, group.batchTotals, group.grandTotal, group.totalValue)}
                    >
                      {isSaving === group.prefix ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-link mr-2"></i>} UNIFICAR
                    </Button>
                  ) : (
                    <>
                      <Button 
                        className="h-14 px-8 opacity-50 cursor-not-allowed"
                        disabled={true}
                      >
                        <i className="fas fa-check-circle mr-2"></i> UNIFICADO
                      </Button>
                      <Button 
                        variant="outline"
                        className="h-14 px-8 border-primary/30 text-primary hover:bg-primary-light"
                        onClick={() => generateUnifiedCityPDF(group.existing!)}
                      >
                        <i className="fas fa-file-pdf mr-2"></i> GERAR PDF
                      </Button>
                      <Button 
                        variant="outline"
                        className="h-14 px-8 border-red-500/30 text-red-500 hover:bg-red-500/5"
                        onClick={() => handleDelete(group.existing!.id!)}
                      >
                        <i className="fas fa-trash-alt mr-2"></i> REMOVER
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {excludeModal?.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-md p-8 space-y-6 shadow-2xl border-2 border-red-500/20">
            <div className="flex items-center gap-4 text-red-500">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <i className="fas fa-exclamation-triangle text-xl"></i>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Confirmar Remoção</h3>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-text-primary leading-relaxed">
                Deseja remover a cidade <span className="font-black text-red-500">"{excludeModal.city}"</span> deste agrupamento sugerido?
              </p>

              <div className="p-4 rounded-xl bg-background border border-border-light space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Pedidos Afetados</span>
                  <span className="text-sm font-black text-text-primary">{excludeModal.ordersCount} un.</span>
                </div>
                
                {excludeModal.otherGroups.length > 0 ? (
                  <div className="pt-2 border-t border-border-light">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Atenção</p>
                    <p className="text-xs font-bold text-text-secondary">
                      Esta cidade também pode se encaixar nos grupos: <span className="text-text-primary">{excludeModal.otherGroups.join(', ')}</span>.
                    </p>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-border-light">
                    <p className="text-xs font-bold text-text-secondary italic">
                      Esta cidade não se encaixa em outros agrupamentos sugeridos no momento.
                    </p>
                  </div>
                )}
              </div>

              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest text-center">
                Os pedidos originais não serão alterados.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                className="flex-1 h-12"
                onClick={() => setExcludeModal(null)}
              >
                CANCELAR
              </Button>
              <Button 
                className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white border-none"
                onClick={confirmExclude}
              >
                CONFIRMAR REMOÇÃO
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
