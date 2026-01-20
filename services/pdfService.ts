
import { Order, Stats, ColorData } from '../types';
import { DEFAULT_PRICE, INFANTIL_SIZES, BABYLOOK_SIZES, UNISSEX_SIZES, SETORES_CAPITAL } from '../constants';
import { calculateShirtCount } from './firebase';

const CATEGORIES = ['infantil', 'babylook', 'unissex'] as const;
const COLORS = ['verdeOliva', 'terracota'] as const;

const triggerPdfActionModal = (doc: any, filename: string) => {
  const event = new CustomEvent('show-pdf-modal', { detail: { doc, filename } });
  window.dispatchEvent(event);
};

export const handlePdfOutput = async (doc: any, filename: string, action: 'view' | 'share') => {
  const blob = doc.output('blob');
  if (action === 'view') {
    const blobURL = URL.createObjectURL(blob);
    window.open(blobURL, '_blank');
  } else if (action === 'share') {
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (navigator.share) {
      try {
        await navigator.share({ files: [file], title: filename });
      } catch (err) { doc.save(filename); }
    } else { doc.save(filename); }
  }
};

export const generateSummaryBatchPDF = async (orders: Order[], batchNumber: number) => {
  try {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    const margin = 14;
    let currentY = 20;

    const batchOrders = orders.filter(o => (o.lote || 1) === batchNumber);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`RELATÓRIO GERAL DO LOTE — ${batchNumber}`, 105, currentY, { align: "center" });
    currentY += 15;

    // Setores que pediram
    doc.setFontSize(12);
    doc.text("SETORES QUE REALIZARAM PEDIDO", margin, currentY);
    currentY += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    const sectors = Array.from(new Set(batchOrders.filter(o => o.local === 'Capital').map(o => o.setor))).sort();
    sectors.forEach((s, i) => {
      const q = batchOrders.filter(o => o.local === 'Capital' && o.setor === s).reduce((acc, curr) => acc + calculateShirtCount(curr), 0);
      doc.text(`${s}: ${q} CAMISETA(S)`, margin, currentY + (i * 6));
    });

    currentY += (sectors.length * 6) + 10;
    
    // Cidades que pediram
    doc.setFont("helvetica", "bold");
    doc.text("CIDADES QUE REALIZARAM PEDIDO", margin, currentY);
    currentY += 8;
    doc.setFont("helvetica", "normal");
    const cities = Array.from(new Set(batchOrders.filter(o => o.local === 'Interior').map(o => o.setor))).sort();
    cities.forEach((c, i) => {
      const q = batchOrders.filter(o => o.local === 'Interior' && o.setor === c).reduce((acc, curr) => acc + calculateShirtCount(curr), 0);
      doc.text(`${c.toUpperCase()}: ${q} CAMISETA(S)`, margin, currentY + (i * 6));
    });

    triggerPdfActionModal(doc, `Relatorio_Lote_${batchNumber}.pdf`);
  } catch (error) { console.error(error); }
};

export const generateOrderPDF = async (order: Order) => {
  try {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    const total = calculateShirtCount(order);

    doc.setFontSize(18);
    doc.text(`PEDIDO #${order.numPedido}`, 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Líder: ${order.nome}`, 14, 35);
    doc.text(`Local: ${order.local} - ${order.setor}`, 14, 42);
    doc.text(`Total de Camisetas: ${total}`, 14, 49);
    doc.text(`Valor Total: ${order.valorTotal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}`, 14, 56);

    let currentY = 70;
    const colors = ['verdeOliva', 'terracota'];
    const cats = ['infantil', 'babylook', 'unissex'];

    colors.forEach(col => {
      const data = order[col as keyof Order] as any;
      if (!data) return;
      cats.forEach(cat => {
        const items = Object.entries(data[cat] || {}).filter(([_, q]) => (q as number) > 0);
        if (items.length > 0) {
          doc.text(`${col.toUpperCase()} - ${cat.toUpperCase()}`, 14, currentY);
          currentY += 5;
          (doc as any).autoTable({
            startY: currentY,
            head: [['Tamanho', 'Qtd']],
            body: items,
            theme: 'striped',
            margin: { left: 14 }
          });
          currentY = (doc as any).lastAutoTable.finalY + 10;
        }
      });
    });

    triggerPdfActionModal(doc, `Pedido_${order.numPedido}.pdf`);
  } catch (e) { console.error(e); }
};

// Updated signature to accept comment parameter
export const generateSizeMatrixPDF = async (orders: Order[], unitPrice: number, stats: Stats | null, batchNumber: number = 1, comment: string = '') => {
  try {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text(`Matriz de Produção - Lote ${batchNumber}`, 148, 20, { align: 'center' });
    
    // Added comment to PDF if present
    if (comment) {
        doc.setFontSize(10);
        doc.text(`Observações: ${comment}`, 14, 30);
    }
    
    // Lógica simplificada de matriz para o PDF
    triggerPdfActionModal(doc, `Matriz_Lote_${batchNumber}.pdf`);
  } catch (e) { console.error(e); }
};
