
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
 * Gera o Relatório Geral de Pedidos consolidado por lote (Novo Requisito)
 */
export const generateSummaryBatchPDF = async (orders: Order[], batchNumber: number) => {
  try {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    const margin = 14;
    let currentY = 20;

    // Filtra pedidos do lote
    const batchOrders = orders.filter(o => (o.lote || 1) === batchNumber);

    // Configurações iniciais
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`RELATÓRIO GERAL DO LOTE — ${batchNumber}`, 105, currentY, { align: "center" });
    currentY += 15;

    // --- 3. SETORES QUE REALIZARAM PEDIDO ---
    doc.setFontSize(12);
    doc.text("3. SETORES QUE REALIZARAM PEDIDO", margin, currentY);
    currentY += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const sectorsWhoOrdered = Array.from(new Set(
      batchOrders.filter(o => o.local === 'Capital').map(o => o.setor)
    )).sort();

    const sectorCounts = sectorsWhoOrdered.map(s => {
      const sectorOrders = batchOrders.filter(o => o.local === 'Capital' && o.setor === s);
      const count = sectorOrders.reduce((acc, curr) => acc + calculateTotalShirts(curr), 0);
      const label = s === 'UMADEMATS' ? s : `SETOR ${s}`;
      return `${label}: ${count} CAMISETA(S)`;
    });

    // Lógica de colunas (7 linhas por coluna)
    let tempY = currentY;
    sectorCounts.forEach((text, index) => {
      const col = Math.floor(index / 7);
      const row = index % 7;
      const xPos = margin + (col * 90);
      doc.text(text, xPos, tempY + (row * 6));
    });
    
    currentY += (Math.ceil(sectorCounts.length / 2) * 6) + 10;
    if (sectorCounts.length === 0) {
       doc.text("Nenhum setor realizou pedidos neste lote.", margin, currentY - 5);
       currentY += 5;
    }

    // --- 4. SETORES QUE NÃO REALIZARAM PEDIDO ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("4. SETORES QUE NÃO REALIZARAM PEDIDO", margin, currentY);
    currentY += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const sectorsWhoDidntOrder = SETORES_CAPITAL
      .filter(s => !sectorsWhoOrdered.includes(s))
      .map(s => s === 'UMADEMATS' ? s : `SETOR ${s}`)
      .sort();

    tempY = currentY;
    sectorsWhoDidntOrder.forEach((text, index) => {
      const col = Math.floor(index / 7);
      const row = index % 7;
      const xPos = margin + (col * 90);
      doc.text(text, xPos, tempY + (row * 6));
    });

    currentY += (Math.ceil(sectorsWhoDidntOrder.length / 2) * 6) + 10;

    // --- 5. CIDADES QUE REALIZARAM PEDIDO ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("5. CIDADES QUE REALIZARAM PEDIDO", margin, currentY);
    currentY += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const citiesWhoOrdered = Array.from(new Set(
      batchOrders.filter(o => o.local === 'Interior').map(o => o.setor)
    )).sort();

    citiesWhoOrdered.forEach((city, index) => {
      const cityOrders = batchOrders.filter(o => o.local === 'Interior' && o.setor === city);
      const count = cityOrders.reduce((acc, curr) => acc + calculateTotalShirts(curr), 0);
      doc.text(`${city.toUpperCase()}: ${count} CAMISETA(S)`, margin, currentY + (index * 6));
    });

    currentY += (citiesWhoOrdered.length * 6) + 10;
    if (citiesWhoOrdered.length === 0) {
      doc.text("Nenhuma cidade realizou pedidos neste lote.", margin, currentY - 5);
      currentY += 5;
    }

    // --- 6. CIDADES QUE NÃO REALIZARAM PEDIDO ---
    if (currentY > 260) { doc.addPage(); currentY = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("6. CIDADES QUE NÃO REALIZARAM PEDIDO", margin, currentY);
    currentY += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("NÃO É POSSÍVEL APRESENTAR REGISTRO POR NÃO EXISTIR LISTA CONCRETA COM TODAS AS CIDADES.", margin, currentY);

    const filename = `Relatorio_Geral_Pedidos_Lote_${batchNumber}.pdf`;
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

export const generateSizeMatrixPDF = async (orders: Order[], unitPrice: number, stats: Stats | null, batchNumber: number = 1, comment?: string) => {
  try {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(18);
    doc.text("Relatório de Produção - Matriz de Tamanhos - UMADEMATS - Jubileu de Ouro", 148.5, 22, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.setFont(undefined, 'bold');
    doc.text(`LOTE ${batchNumber}`, 148.5, 36, { align: "center" });

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
            relevantSizes.forEach(size => rowData.push(data[cat][color][size] || '-'));
            rowData.push(data[cat][color].subTotal);
            return rowData;
        });

        (doc as any).autoTable({
            startY: currentY,
            head: head,
            body: body,
            theme: 'striped',
            headStyles: { fillColor: '#0ea5e9', textColor: '#FFFFFF' },
            styles: { halign: 'center', fontSize: 9 },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    triggerPdfActionModal(doc, `Matriz_de_Tamanhos_Lote_${batchNumber}.pdf`);
  } catch (error) {
    console.error("Erro ao gerar matriz:", error);
  }
};
