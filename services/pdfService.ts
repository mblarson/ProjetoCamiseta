import { Order, Stats, ColorData } from '../types';
import { DEFAULT_PRICE, INFANTIL_SIZES, BABYLOOK_SIZES, UNISSEX_SIZES, SETORES_CAPITAL } from '../constants';

const CATEGORIES = ['infantil', 'babylook', 'unissex'] as const;
const COLORS = ['verdeOliva', 'terracota'] as const;

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
 * Gera o Relatório Geral de Pedidos consolidado por lote com tabelas visuais e totalizadores
 */
export const generateSummaryBatchPDF = async (orders: Order[], batchNumber: number) => {
  try {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    const primaryColor = [14, 165, 233]; // #0ea5e9
    
    const isGlobal = batchNumber === 999;
    const batchesToProcess = isGlobal 
      ? Array.from(new Set(orders.map(o => o.lote || 1))).sort((a,b) => a-b) 
      : [batchNumber];

    const addBatchPage = (bn: number, isLast: boolean) => {
      const batchOrders = orders.filter(o => (o.lote || 1) === bn);
      const totalCamisetasLote = batchOrders.reduce((acc, curr) => acc + calculateTotalShirts(curr), 0);
      const totalFinanceiroLote = batchOrders.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);

      // Cabeçalho Premium
      doc.setFillColor(30, 41, 59); // Slate 800
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
      doc.text(`LOTE DE PRODUÇÃO — ${bn}`, 105, 34, { align: "center" });

      let currentY = 50;

      // Tabela 1: Resumo de Métricas
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

      // Tabela 2: Setores da Capital com Pedidos
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

      // Tabela 3: Setores Pendentes (Capital)
      const sectorsWhoDidntOrder = SETORES_CAPITAL
        .filter(s => !sectorsWhoOrdered.includes(s))
        .map(s => [s === 'UMADEMATS' ? s : `SETOR ${s}`, 'PENDENTE'])
        .sort();

      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38); // Red 600
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

      // Tabela 4: Interior
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

      if (!isLast) {
        doc.addPage();
      }
    };

    batchesToProcess.forEach((bn, idx) => {
      addBatchPage(bn, idx === batchesToProcess.length - 1 && !isGlobal);
    });

    // Se for Global, adiciona a seção final de estatísticas
    if (isGlobal) {
      doc.addPage();
      
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text("UMADEMATS", 105, 18, { align: "center" });
      doc.setFontSize(14);
      doc.text("ESTATÍSTICAS GERAIS CONSOLIDADAS", 105, 30, { align: "center" });

      let currentY = 55;

      // TOTAL DE CAMISETAS POR LOTE
      const batchSummaryRows = batchesToProcess.map(bn => {
        const batchOrders = orders.filter(o => (o.lote || 1) === bn);
        const count = batchOrders.reduce((acc, curr) => acc + calculateTotalShirts(curr), 0);
        return [`LOTE ${bn}`, `${count} UNIDADES`];
      });

      (doc as any).autoTable({
        startY: currentY,
        head: [['LOTE DE PRODUÇÃO', 'VOLUME DE CAMISETAS']],
        body: batchSummaryRows,
        theme: 'grid',
        headStyles: { fillColor: primaryColor },
        styles: { halign: 'center', fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' } }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // TOTAL POR SETOR (SOMA DE TODOS OS LOTES)
      const capitalOrders = orders.filter(o => o.local === 'Capital');
      const allSectors = Array.from(new Set(capitalOrders.map(o => o.setor))).sort();
      const sectorSummaryRows = allSectors.map(s => {
        const sectorOrders = capitalOrders.filter(o => o.setor === s);
        const count = sectorOrders.reduce((acc, curr) => acc + calculateTotalShirts(curr), 0);
        return [s === 'UMADEMATS' ? s : `SETOR ${s}`, `${count} un.`];
      });

      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("SOMA POR SETOR (CAPITAL - TODOS OS LOTES)", 14, currentY - 5);

      (doc as any).autoTable({
        startY: currentY,
        head: [['SETOR / DEPARTAMENTO', 'TOTAL ACUMULADO']],
        body: sectorSummaryRows,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
      });

      currentY = (doc as any).lastAutoTable.finalY + 20;

      // RESUMO FINANCEIRO FINAL
      const grandTotalShirts = orders.reduce((acc, curr) => acc + calculateTotalShirts(curr), 0);
      const grandTotalValue = orders.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);

      (doc as any).autoTable({
        startY: currentY,
        head: [['RESUMO FINANCEIRO GERAL', 'TOTAL CONSOLIDADO']],
        body: [
          ['VOLUME TOTAL DE CAMISETAS', `${grandTotalShirts} UNIDADES`],
          ['ARRECADAÇÃO TOTAL PREVISTA', grandTotalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]
        ],
        theme: 'grid',
        headStyles: { fillColor: [22, 163, 74], textColor: 255 },
        styles: { fontSize: 12, fontStyle: 'bold', cellPadding: 8 },
        columnStyles: { 1: { halign: 'right', textColor: [22, 163, 74] } }
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

    const textColor = '#1e293b'; 

    doc.setFontSize(20);
    doc.setTextColor(textColor);
    doc.text("UMADEMATS - JUBILEU DE OURO", 105, 20, { align: "center" });
    
    doc.setFontSize(14);
    doc.setTextColor(textColor);
    doc.text(`PEDIDO #${order.numPedido}`, 105, 28, { align: "center" });

    const infoStartY = 40;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Líder: ${order.nome}`, 14, infoStartY);
    doc.text(`Localização: ${order.local} - ${formatSetor(order)}`, 14, infoStartY + 7);
    doc.text(`E-mail: ${order.email}`, 14, infoStartY + 14);
    doc.text(`Contato: ${order.contato}`, 14, infoStartY + 21);
    doc.text(`Data: ${new Date(order.data).toLocaleDateString('pt-BR')}`, 14, infoStartY + 28);

    let currentY = 75;

    const renderCategoryGrid = (colorLabel: string, categoryLabel: string, colorKey: 'verdeOliva' | 'terracota', categoryKey: typeof CATEGORIES[number], headerColor: string) => {
      const colorData = order[colorKey];
      if (!colorData) return false;

      const categoryData = colorData[categoryKey];
      if (!categoryData) return false;

      const rows: any[] = [];
      Object.entries(categoryData).forEach(([size, qty]) => {
        if ((qty as number) > 0) {
          rows.push([size, qty]);
        }
      });

      if (rows.length === 0) return false;

      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(11);
      doc.setTextColor(headerColor);
      doc.setFont(undefined, 'bold');
      doc.text(`${colorLabel.toUpperCase()} - ${categoryLabel.toUpperCase()}`, 14, currentY);
      currentY += 4;

      (doc as any).autoTable({
        startY: currentY,
        head: [['Tamanho', 'Quantidade']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: headerColor, textColor: '#FFFFFF' },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9, halign: 'center' },
        columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' } }
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;
      return true;
    };

    let hasAnyItem = false;
    const verdeColor = "#556B2F";
    const terraColor = "#a35e47";
    
    if (renderCategoryGrid("Verde Oliva", "Infantil", "verdeOliva", "infantil", verdeColor)) hasAnyItem = true;
    if (renderCategoryGrid("Verde Oliva", "Babylook", "verdeOliva", "babylook", verdeColor)) hasAnyItem = true;
    if (renderCategoryGrid("Verde Oliva", "Unissex", "verdeOliva", "unissex", verdeColor)) hasAnyItem = true;
    
    if (renderCategoryGrid("Terracota", "Infantil", "terracota", "infantil", terraColor)) hasAnyItem = true;
    if (renderCategoryGrid("Terracota", "Babylook", "terracota", "babylook", terraColor)) hasAnyItem = true;
    if (renderCategoryGrid("Terracota", "Unissex", "terracota", "unissex", terraColor)) hasAnyItem = true;

    if (!hasAnyItem) {
        doc.setFontSize(10);
        doc.setTextColor(150, 0, 0);
        doc.text("Nenhum item registrado neste pedido.", 14, currentY);
        currentY += 10;
    }

    currentY += 5;
    doc.setFontSize(12);
    doc.setTextColor(textColor);
    doc.setFont(undefined, 'bold');
    doc.text(`VALOR TOTAL DO PEDIDO: ${order.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${totalCamisetas} CAMISETAS)`, 14, currentY);
    
    triggerPdfActionModal(doc, `Pedido_${order.numPedido}.pdf`);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert(`Erro ao gerar PDF do pedido #${order.numPedido}.`);
  }
};

export const generateSizeMatrixPDF = async (orders: Order[], unitPrice: number, stats: Stats | null, batchNumber: number | 'Geral' = 1, comment?: string) => {
  try {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(18);
    doc.text("Relatório de Produção - Matriz de Tamanhos - UMADEMATS - Jubileu de Ouro", 148.5, 22, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.setFont(undefined, 'bold');
    doc.text(batchNumber === 'Geral' ? "TOTAL CONSOLIDADO (TODOS OS LOTES)" : `LOTE ${batchNumber}`, 148.5, 36, { align: "center" });

    const data: any = {};
    let grandTotal = 0;
    const allUniqueSizes = Array.from(new Set([...INFANTIL_SIZES, ...BABYLOOK_SIZES, ...UNISSEX_SIZES]));

    CATEGORIES.forEach(cat => {
      data[cat] = { rowTotal: 0 };
      COLORS.forEach(color => {
        data[cat][color] = { subTotal: 0 };
        allUniqueSizes.forEach(size => {
          data[cat][color][size] = 0;
        });
      });
    });

    orders.forEach(order => {
      COLORS.forEach(color => {
        const colorData = order[color];
        if (colorData) {
          CATEGORIES.forEach(cat => {
            const categoryData = colorData[cat];
            if (categoryData) {
              Object.entries(categoryData).forEach(([size, qty]) => {
                if (typeof qty === 'number') {
                  data[cat][color][size] = (data[cat][color][size] || 0) + qty;
                  data[cat][color].subTotal += qty;
                  data[cat].rowTotal += qty;
                  grandTotal += qty;
                }
              });
            }
          });
        }
      });
    });

    let currentY = 42;
    CATEGORIES.forEach((cat) => {
        let relevantSizes = cat === 'infantil' ? INFANTIL_SIZES : (cat === 'babylook' ? BABYLOOK_SIZES : UNISSEX_SIZES);
        
        const head = [[`TABELA — ${cat.toUpperCase()}`, ...relevantSizes, 'TOTAL']];
        const body = COLORS.map(color => {
            const rowData = [ color === 'verdeOliva' ? 'Verde Oliva' : 'Terracota' ];
            relevantSizes.forEach(size => rowData.push(String(data[cat][color][size] || '-')));
            rowData.push(String(data[cat][color].subTotal));
            return rowData;
        });

        // Cálculo dos totalizadores das colunas (tamanhos) para esta categoria
        const footData = ['TOTAIS POR TAMANHO'];
        relevantSizes.forEach(size => {
            let sizeTotal = 0;
            COLORS.forEach(color => {
                sizeTotal += (data[cat][color][size] || 0);
            });
            footData.push(String(sizeTotal || '-'));
        });
        // Soma do rodapé para a coluna 'TOTAL'
        let catGrandTotal = 0;
        COLORS.forEach(color => catGrandTotal += data[cat][color].subTotal);
        footData.push(String(catGrandTotal));

        (doc as any).autoTable({
            startY: currentY,
            head: head,
            body: body,
            foot: [footData],
            theme: 'striped',
            headStyles: { fillColor: '#0ea5e9', textColor: '#FFFFFF' },
            footStyles: { fillColor: '#f1f5f9', textColor: '#1e293b', fontStyle: 'bold' },
            styles: { halign: 'center', fontSize: 9 },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    // Inclusão dos totalizadores gerais do Lote no final do PDF
    if (currentY > 170) {
      doc.addPage();
      currentY = 25;
    }

    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.setFont(undefined, 'bold');
    doc.text(`QUANTIDADE TOTAL DE CAMISETAS: ${grandTotal}`, 14, currentY);
    currentY += 8;
    const totalMoney = grandTotal * unitPrice;
    doc.text(`VALOR TOTAL (${batchNumber === 'Geral' ? 'CONSOLIDADO' : `LOTE ${batchNumber}`}): ${totalMoney.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, currentY);

    if (comment) {
      currentY += 15;
      doc.setFontSize(10);
      doc.setFont(undefined, 'italic');
      doc.setTextColor(100);
      doc.text("Observações:", 14, currentY);
      doc.text(comment, 14, currentY + 6, { maxWidth: 260 });
    }

    const filename = batchNumber === 'Geral' ? `Matriz_de_Tamanhos_TOTAL.pdf` : `Matriz_de_Tamanhos_Lote_${batchNumber}.pdf`;
    triggerPdfActionModal(doc, filename);
  } catch (error) {
    console.error("Erro ao gerar matriz:", error);
  }
};