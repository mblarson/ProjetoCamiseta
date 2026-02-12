
import { Order, Stats, ColorData } from '../types';
import { DEFAULT_PRICE, INFANTIL_SIZES, BABYLOOK_SIZES, UNISSEX_SIZES, SETORES_CAPITAL } from '../constants';

const CATEGORIES = ['infantil', 'babylook', 'unissex'] as const;

/**
 * Dispara um evento global para abrir o modal de escolha de ação do PDF
 */
const triggerPdfActionModal = (doc: any, filename: string) => {
  const event = new CustomEvent('show-pdf-modal', { detail: { doc, filename } });
  window.dispatchEvent(event);
};

/**
 * Executa a ação escolhida pelo usuário (Visualizar ou Compartilhar)
 */
export const handlePdfOutput = async (doc: any, filename: string, action: 'view' | 'share') => {
  const blob = doc.output('blob');
  
  if (action === 'view') {
    const blobURL = URL.createObjectURL(blob);
    window.open(blobURL, '_blank');
  } else if (action === 'share') {
    const file = new File([blob], filename, { type: 'application/pdf' });
    
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
          text: 'Segue relação de pedidos em PDF' 
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Falha no compartilhamento:', err);
          doc.save(filename); 
        }
      }
    } else {
      doc.save(filename); 
    }
  }
};

const calculateTotalShirts = (order: Order) => {
  const countColors = (data?: ColorData) => {
    if (!data) return 0;
    let total = 0;
    Object.values(data).forEach(cat => {
      Object.values(cat).forEach(val => total += (Number(val) || 0));
    });
    return total;
  };
  return countColors(order.verdeOliva) + countColors(order.terracota);
};

/**
 * Gera o Relatório Geral de Pedidos consolidado por lote
 */
export const generateSummaryBatchPDF = async (orders: Order[], batchNumber: number) => {
  try {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    const primaryColor = [14, 165, 233]; 
    
    const isGlobal = batchNumber === 999;
    const batchesToProcess = isGlobal 
      ? Array.from(new Set(orders.map(o => o.lote || 1))).sort((a,b) => a-b) 
      : [batchNumber];

    const renderHeader = (bn: number | string) => {
      doc.setFillColor(30, 41, 59); 
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text("UMADEMATS", 105, 18, { align: "center" });
      
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text("RELATÓRIO GERAL DE PERFORMANCE E LOGÍSTICA", 105, 25, { align: "center" });
      
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(typeof bn === 'number' ? `LOTE DE PRODUÇÃO — ${bn}` : bn, 105, 34, { align: "center" });
    };

    const addBatchPage = (bn: number) => {
      const batchOrders = orders.filter(o => (o.lote || 1) === bn);
      const totalCamisetasLote = batchOrders.reduce((acc, curr) => acc + calculateTotalShirts(curr), 0);
      const totalFinanceiroLote = batchOrders.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);

      renderHeader(bn);

      let currentY = 50;

      (doc as any).autoTable({
        startY: currentY,
        head: [['MÉTRICA', 'VALOR CONSOLIDADO']],
        body: [
          ['TOTAL DE PEDIDOS REGISTRADOS', `${batchOrders.length} PEDIDOS`],
          ['VOLUME TOTAL DE CAMISETAS', `${totalCamisetasLote} UNIDADES`],
          ['PROJEÇÃO FINANCEIRA DO LOTE', totalFinanceiroLote.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]
        ],
        theme: 'grid',
        headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 10, cellPadding: 5 },
        columnStyles: { 0: { fontStyle: 'bold', width: 120 }, 1: { halign: 'right' } }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      const sectorsWhoOrdered = Array.from(new Set(
        batchOrders.filter(o => o.local === 'Capital').map(o => o.setor)
      )).sort();

      let totalCapitalShirts = 0;
      const sectorRows = sectorsWhoOrdered.map(s => {
        const sectorOrders = batchOrders.filter(o => o.local === 'Capital' && o.setor === s);
        const count = sectorOrders.reduce((acc, curr) => acc + calculateTotalShirts(curr), 0);
        totalCapitalShirts += count;
        const label = s === 'UMADEMATS' ? s : `SETOR ${s}`;
        return [label, `${count} un.`];
      });

      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("SETORES DA CAPITAL (PEDIDOS REALIZADOS)", 14, currentY - 5);

      (doc as any).autoTable({
        startY: currentY,
        head: [['SETOR / DEPARTAMENTO', 'QUANTIDADE']],
        body: sectorRows.length > 0 ? sectorRows : [['-', 'Nenhum pedido registrado']],
        foot: [['TOTAL PARCIAL CAPITAL', `${totalCapitalShirts} un.`]],
        theme: 'striped',
        headStyles: { fillColor: primaryColor, textColor: 255 },
        footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' } }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      const sectorsWhoDidntOrder = SETORES_CAPITAL
        .filter(s => !sectorsWhoOrdered.includes(s))
        .map(s => [s === 'UMADEMATS' ? s : `SETOR ${s}`, 'PENDENTE'])
        .sort();

      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38); 
      doc.text("SETORES DA CAPITAL (PENDENTES / SEM PEDIDO)", 14, currentY - 5);

      (doc as any).autoTable({
        startY: currentY,
        head: [['SETOR / DEPARTAMENTO', 'STATUS']],
        body: sectorsWhoDidntOrder.length > 0 ? sectorsWhoDidntOrder : [['-', 'Todos os setores realizaram pedidos']],
        foot: [['TOTAL DE SETORES PENDENTES', `${sectorsWhoDidntOrder.length} SETORES`]],
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38], textColor: 255 },
        footStyles: { fillColor: [254, 242, 242], textColor: [220, 38, 38], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'center', fontStyle: 'bold' } }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      const citiesWhoOrdered = Array.from(new Set(
        batchOrders.filter(o => o.local === 'Interior').map(o => o.setor)
      )).sort();

      let totalInteriorShirts = 0;
      const cityRows = citiesWhoOrdered.map(city => {
        const cityOrders = batchOrders.filter(o => o.local === 'Interior' && o.setor === city);
        const count = cityOrders.reduce((acc, curr) => acc + calculateTotalShirts(curr), 0);
        totalInteriorShirts += count;
        return [city.toUpperCase(), `${count} un.`];
      });

      if (currentY > 220) { doc.addPage(); currentY = 20; }
      
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("CIDADES DO INTERIOR (PEDIDOS REALIZADOS)", 14, currentY - 5);

      (doc as any).autoTable({
        startY: currentY,
        head: [['CIDADE / LOCALIDADE', 'QUANTIDADE']],
        body: cityRows.length > 0 ? cityRows : [['-', 'Nenhuma cidade registrada']],
        foot: [['TOTAL PARCIAL INTERIOR', `${totalInteriorShirts} un.`]],
        theme: 'striped',
        headStyles: { fillColor: primaryColor, textColor: 255 },
        footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' } }
      });
    };

    batchesToProcess.forEach((bn, idx) => {
      addBatchPage(bn);
      if (idx < batchesToProcess.length - 1) {
          doc.addPage();
      }
    });

    // Seção de DADOS GERAIS (apenas para o relatório consolidado)
    if (isGlobal) {
      doc.addPage();
      renderHeader("DADOS GERAIS CONSOLIDADOS");
      
      let currentY = 50;
      const totalCamisetas = orders.reduce((acc, curr) => acc + calculateTotalShirts(curr), 0);
      const totalFinanceiro = orders.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);

      (doc as any).autoTable({
        startY: currentY,
        head: [['CATEGORIA', 'VALOR CONSOLIDADO']],
        body: [
            ['TOTAL DE PEDIDOS (TODOS OS LOTES)', `${orders.length} PEDIDOS`],
            ['TOTAL DE CAMISETAS (TODOS OS LOTES)', `${totalCamisetas} UNIDADES`],
            ['VALOR TOTAL PREVISTO', totalFinanceiro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 5 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // CAPITAL CONSOLIDADA
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("CAPITAL — CONSOLIDADO POR SETOR", 14, currentY - 5);

      let totalGlobalCapital = 0;
      const globalSectorRows = SETORES_CAPITAL.map(s => {
          const sectorOrders = orders.filter(o => o.local === 'Capital' && o.setor === s);
          const count = sectorOrders.reduce((acc, curr) => acc + calculateTotalShirts(curr), 0);
          totalGlobalCapital += count;
          const label = s === 'UMADEMATS' ? s : `SETOR ${s}`;
          return [label, `${count} un.`];
      }).sort((a,b) => (a[0] as string).localeCompare(b[0] as string));

      (doc as any).autoTable({
        startY: currentY,
        head: [['SETOR', 'QUANTIDADE TOTAL']],
        body: globalSectorRows,
        foot: [['TOTAL GERAL CAPITAL', `${totalGlobalCapital} un.`]],
        theme: 'striped',
        headStyles: { fillColor: primaryColor },
        footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // INTERIOR CONSOLIDADO (Apenas um totalizador conforme solicitado)
      const interiorOrders = orders.filter(o => o.local === 'Interior');
      const totalGlobalInterior = interiorOrders.reduce((acc, curr) => acc + calculateTotalShirts(curr), 0);

      if (currentY > 240) { doc.addPage(); currentY = 20; }

      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("INTERIOR — CONSOLIDADO GERAL", 14, currentY - 5);

      (doc as any).autoTable({
        startY: currentY,
        head: [['LOCALIDADE', 'QUANTIDADE TOTAL']],
        body: [['TODAS AS CIDADES (INTERIOR)', `${totalGlobalInterior} un.`]],
        theme: 'grid',
        headStyles: { fillColor: primaryColor },
        styles: { fontSize: 10, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } }
      });
    }

    const filename = isGlobal ? `Relatorio_Geral_Pedidos_TOTAL.pdf` : `Relatorio_Geral_Pedidos_Lote_${batchNumber}.pdf`;
    triggerPdfActionModal(doc, filename);
  } catch (error) {
    console.error("Erro ao gerar Relatório Geral:", error);
    alert("Falha ao gerar o relatório consolidado.");
  }
};

export const generateOrderPDF = async (order: Order) => {
  try {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();

    const formatSetor = (order: Order) => {
      if (order.setor === 'UMADEMATS') return 'UMADEMATS';
      return order.local === 'Capital' && !order.setor.startsWith('SETOR') 
        ? `SETOR ${order.setor}` 
        : order.setor;
    };

    let totalCamisetas = 0;
    const countOrderShirts = (data?: ColorData) => {
      if (!data) return;
      Object.values(data).forEach(catData => {
        Object.values(catData).forEach(qty => {
          totalCamisetas += (qty as number || 0);
        });
      });
    };
    countOrderShirts(order.verdeOliva);
    countOrderShirts(order.terracota);

    doc.setFontSize(20);
    doc.setTextColor('#1e293b');
    doc.text("UMADEMATS - JUBILEU DE OURO", 105, 20, { align: "center" });
    
    doc.setFontSize(14);
    doc.text(`PEDIDO #${order.numPedido}`, 105, 28, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Líder: ${order.nome}`, 14, 40);
    doc.text(`Local: ${order.local} - ${formatSetor(order)}`, 14, 47);
    doc.text(`Data: ${new Date(order.data).toLocaleDateString('pt-BR')}`, 14, 54);

    let currentY = 70;

    const renderGrid = (colorName: string, category: typeof CATEGORIES[number], colorKey: 'verdeOliva' | 'terracota', headerColor: string) => {
      const colorData = order[colorKey];
      if (!colorData) return false;
      const catData = colorData[category];
      if (!catData) return false;

      let sizes: string[] = [];
      let catLabel = "";
      if (category === 'infantil') { sizes = INFANTIL_SIZES; catLabel = "INFANTIL"; }
      else if (category === 'babylook') { sizes = BABYLOOK_SIZES; catLabel = "BABY LOOK"; }
      else { sizes = UNISSEX_SIZES; catLabel = "ADULTO"; }

      const rows: any[] = [];
      sizes.forEach(sz => {
        const qty = catData[sz];
        if (typeof qty === 'number' && qty > 0) {
          rows.push([sz, qty]);
        }
      });

      if (rows.length === 0) return false;

      if (currentY > 240) { doc.addPage(); currentY = 20; }

      doc.setFontSize(11);
      doc.setTextColor(headerColor);
      doc.setFont("helvetica", "bold");
      doc.text(`${colorName.toUpperCase()} - ${catLabel}`, 14, currentY);
      currentY += 4;

      (doc as any).autoTable({
        startY: currentY,
        head: [['Tamanho', 'Quantidade']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: headerColor, textColor: '#FFFFFF' },
        styles: { fontSize: 9, halign: 'center' },
        columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' } }
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
      return true;
    };

    const verde = "#556B2F";
    const terra = "#a35e47";
    
    // Ordem estrita: Verde Oliva depois Terracota
    // Ordem estrita de Categorias: Infantil, Baby Look, Adulto
    renderGrid("Verde Oliva", "infantil", "verdeOliva", verde);
    renderGrid("Verde Oliva", "babylook", "verdeOliva", verde);
    renderGrid("Verde Oliva", "unissex", "verdeOliva", verde);
    
    renderGrid("Terracota", "infantil", "terracota", terra);
    renderGrid("Terracota", "babylook", "terracota", terra);
    renderGrid("Terracota", "unissex", "terracota", terra);

    doc.setFontSize(12);
    doc.setTextColor('#1e293b');
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: ${order.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${totalCamisetas} Camisetas)`, 14, currentY + 5);
    
    triggerPdfActionModal(doc, `Pedido_${order.numPedido}.pdf`);
  } catch (error) {
    console.error("Erro PDF:");
  }
};

export const generateSizeMatrixPDF = async (orders: Order[], unitPrice: number, stats: Stats | null, batchNumber: number | 'Geral' = 1, comment?: string) => {
  try {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(18);
    doc.text("Relatório de Produção - Matriz de Tamanhos - UMADEMATS", 148.5, 22, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(batchNumber === 'Geral' ? "CONSOLIDADO GERAL" : `LOTE ${batchNumber}`, 148.5, 30, { align: "center" });

    let grandTotal = 0;
    let currentY = 40;

    CATEGORIES.forEach(cat => {
      let sizes = cat === 'infantil' ? INFANTIL_SIZES : (cat === 'babylook' ? BABYLOOK_SIZES : UNISSEX_SIZES);
      let catLabel = cat === 'infantil' ? "INFANTIL" : (cat === 'babylook' ? "BABY LOOK" : "ADULTO");

      const body: any[] = [];
      const verdeRow: any[] = ["Verde Oliva"];
      const terraRow: any[] = ["Terracota"];
      const footerRow: any[] = ["Total"];

      let catTotal = 0;
      sizes.forEach(sz => {
        let vQty = 0;
        let tQty = 0;
        orders.forEach(o => {
          vQty += (o.verdeOliva?.[cat]?.[sz] || 0);
          tQty += (o.terracota?.[cat]?.[sz] || 0);
        });
        verdeRow.push(vQty || '-');
        terraRow.push(tQty || '-');
        footerRow.push(vQty + tQty || '-');
        catTotal += (vQty + tQty);
      });

      verdeRow.push(verdeRow.slice(1).reduce((a:any, b:any) => a + (Number(b) || 0), 0));
      terraRow.push(terraRow.slice(1).reduce((a:any, b:any) => a + (Number(b) || 0), 0));
      footerRow.push(catTotal);
      grandTotal += catTotal;

      (doc as any).autoTable({
        startY: currentY,
        head: [[catLabel, ...sizes, 'Total']],
        body: [verdeRow, terraRow],
        foot: [footerRow],
        theme: 'grid',
        headStyles: { fillColor: '#0ea5e9' },
        styles: { halign: 'center', fontSize: 8 },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.setFontSize(14);
    doc.text(`TOTAL GERAL: ${grandTotal} Camisetas`, 14, currentY + 5);

    triggerPdfActionModal(doc, `Matriz_Lote_${batchNumber}.pdf`);
  } catch (error) {
    console.error("Erro Matriz:", error);
  }
};
