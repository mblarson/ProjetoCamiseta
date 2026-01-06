
import { Order, Stats, ColorData } from '../types';
import { DEFAULT_PRICE, INFANTIL_SIZES, BABYLOOK_SIZES, UNISSEX_SIZES } from '../constants';

const CATEGORIES = ['infantil', 'babylook', 'unissex'] as const;
const COLORS = ['verdeOliva', 'terracota'] as const;

/**
 * Helper para visualizar o PDF primeiro e depois oferecer compartilhamento
 */
const saveOrShare = async (doc: any, filename: string) => {
  const blob = doc.output('blob');
  const blobURL = URL.createObjectURL(blob);
  
  // Identifica se é dispositivo móvel para aplicar lógica de automação
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // 1. Visualização: Abre em nova aba primeiro (Preview)
  const previewWindow = window.open(blobURL, '_blank');

  // 2. Preparação para compartilhamento
  const file = new File([blob], filename, { type: 'application/pdf' });

  // Verifica se o navegador suporta compartilhamento de arquivos
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      // 3. Compartilhamento automático
      // REMOÇÃO DO TEXTO: O campo 'text' foi removido para evitar mensagens automáticas no WhatsApp
      await navigator.share({
        files: [file],
        title: filename
      });
    } catch (err) {
      // Se falhar por restrição de gesto ou cancelamento, apenas logamos.
      // A visualização já foi aberta acima (previewWindow).
      if ((err as Error).name !== 'AbortError') {
        console.warn('O compartilhamento automático foi bloqueado pelo navegador ou falhou, mas a visualização está disponível.', err);
      }
    }
  }

  // Fallback: Se a janela de preview foi bloqueada pelo navegador e o share falhou ou não existe
  if (!previewWindow && (!navigator.share || !isMobile)) {
    doc.save(filename);
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

    // Cálculo da soma total de camisetas do pedido
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

    // Configurações de Cores e Estilos
    const textColor = '#1e293b'; 

    // Cabeçalho
    doc.setFontSize(20);
    doc.setTextColor(textColor);
    doc.text("UMADEMATS - JUBILEU DE OURO", 105, 20, { align: "center" });
    
    doc.setFontSize(14);
    doc.setTextColor(textColor);
    doc.text(`PEDIDO #${order.numPedido}`, 105, 28, { align: "center" });

    // Informações do Líder
    const infoStartY = 40;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Líder: ${order.nome}`, 14, infoStartY);
    doc.text(`Localização: ${order.local} - ${formatSetor(order)}`, 14, infoStartY + 7);
    doc.text(`E-mail: ${order.email}`, 14, infoStartY + 14);
    doc.text(`Contato: ${order.contato}`, 14, infoStartY + 21);
    doc.text(`Data: ${new Date(order.data).toLocaleDateString('pt-BR')}`, 14, infoStartY + 28);

    let currentY = 75;

    // Função para renderizar uma tabela específica por categoria e cor
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

    // Seção VERDE OLIVA
    const verdeColor = "#556B2F";
    const verdeLabel = "Verde Oliva";
    
    if (renderCategoryGrid(verdeLabel, "Infantil", "verdeOliva", "infantil", verdeColor)) hasAnyItem = true;
    if (renderCategoryGrid(verdeLabel, "Babylook", "verdeOliva", "babylook", verdeColor)) hasAnyItem = true;
    if (renderCategoryGrid(verdeLabel, "Unissex", "verdeOliva", "unissex", verdeColor)) hasAnyItem = true;

    // Seção TERRACOTA
    const terraColor = "#a35e47";
    const terraLabel = "Terracota";
    
    if (renderCategoryGrid(terraLabel, "Infantil", "terracota", "infantil", terraColor)) hasAnyItem = true;
    if (renderCategoryGrid(terraLabel, "Babylook", "terracota", "babylook", terraColor)) hasAnyItem = true;
    if (renderCategoryGrid(terraLabel, "Unissex", "terracota", "unissex", terraColor)) hasAnyItem = true;

    if (!hasAnyItem) {
        doc.setFontSize(10);
        doc.setTextColor(150, 0, 0);
        doc.text("Nenhum item registrado neste pedido.", 14, currentY);
        currentY += 10;
    }

    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    } else {
      currentY += 5;
    }

    doc.setFontSize(12);
    doc.setTextColor(textColor);
    doc.setFont(undefined, 'bold');
    const valorTotalFormatado = order.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    doc.text(`VALOR TOTAL DO PEDIDO: ${valorTotalFormatado} (${totalCamisetas} CAMISETAS)`, 14, currentY);
    currentY += 10;

    if (order.observacao) {
      if (currentY > 260) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(textColor);
      doc.text("OBSERVAÇÕES DO PEDIDO:", 14, currentY);
      currentY += 6;
      
      doc.setFont(undefined, 'normal');
      doc.setTextColor(80, 80, 80);
      const splitObs = doc.splitTextToSize(order.observacao, 180);
      doc.text(splitObs, 14, currentY);
    }

    await saveOrShare(doc, `Pedido_${order.numPedido}.pdf`);
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
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 148.5, 29, { align: "center" });
    
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
    const primaryColor = '#0ea5e9';

    CATEGORIES.forEach((cat) => {
        let relevantSizes: string[];
        if (cat === 'infantil') relevantSizes = INFANTIL_SIZES;
        else if (cat === 'babylook') relevantSizes = BABYLOOK_SIZES;
        else relevantSizes = UNISSEX_SIZES;

        const head = [[`TABELA — ${cat.toUpperCase()}`, ...relevantSizes, 'TOTAL']];
        const body: any[] = [];
        
        COLORS.forEach(color => {
            const rowData = [ color === 'verdeOliva' ? 'Verde Oliva' : 'Terracota' ];
            relevantSizes.forEach(size => {
                const value = data[cat][color][size];
                rowData.push(value > 0 ? value.toLocaleString('pt-BR') : '-');
            });
            rowData.push(data[cat][color].subTotal.toLocaleString('pt-BR'));
            body.push(rowData);
        });

        (doc as any).autoTable({
            startY: currentY,
            head: head,
            body: body,
            theme: 'striped',
            headStyles: { fillColor: primaryColor, textColor: '#FFFFFF', fontStyle: 'bold' },
            foot: [['TOTAL CATEGORIA', ...relevantSizes.map(() => ''), data[cat].rowTotal.toLocaleString('pt-BR')]],
            footStyles: { fillColor: '#F1F5F9', textColor: '#1E293B', fontStyle: 'bold' },
            styles: { halign: 'center', cellPadding: 2, fontSize: 9 },
            columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 40 } },
            margin: { left: 14, right: 14 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    if (currentY > 180) {
        doc.addPage();
        currentY = 20;
    }
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30);
    const footerText = `TOTAL GERAL DE PEDIDOS: ${grandTotal.toLocaleString('pt-BR')} CAMISETAS`;
    doc.text(footerText, 280, currentY + 5, { align: "right" });
    
    currentY += 15;

    if (comment) {
        if (currentY > 185) {
            doc.addPage();
            currentY = 20;
        }
        doc.setFontSize(11);
        doc.setTextColor(50);
        doc.setFont(undefined, 'bold');
        doc.text("OBSERVAÇÕES GERAIS:", 14, currentY);
        currentY += 6;
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        const splitComment = doc.splitTextToSize(comment, 260);
        doc.text(splitComment, 14, currentY);
    }

    const matrixFilename = `Matriz_de_Tamanhos_Lote_${batchNumber}_${new Date().toISOString().slice(0, 10)}.pdf`;
    await saveOrShare(doc, matrixFilename);
  } catch (error) {
    console.error("Erro ao gerar matriz:", error);
    alert("Erro ao gerar PDF da Matriz de Tamanhos.");
  }
};
