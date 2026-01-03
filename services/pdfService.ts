
import { Order, Stats } from '../types';
import { DEFAULT_PRICE, INFANTIL_SIZES, ADULTO_SIZES } from '../constants';

const CATEGORIES = ['infantil', 'babylook', 'unissex'] as const;
const COLORS = ['verdeOliva', 'terracota'] as const;

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

      // Verificar se a tabela cabe na página, senão adiciona nova página
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      // Título da Tabela (Cor + Categoria)
      doc.setFontSize(11);
      doc.setTextColor(headerColor);
      doc.setFont(undefined, 'bold');
      doc.text(`${colorLabel.toUpperCase()} - ${categoryLabel.toUpperCase()}`, 14, currentY);
      currentY += 4;

      // Renderização do Grid/Tabela
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
    
    const vInf = renderCategoryGrid(verdeLabel, "Infantil", "verdeOliva", "infantil", verdeColor);
    const vBl = renderCategoryGrid(verdeLabel, "Babylook", "verdeOliva", "babylook", verdeColor);
    const vUni = renderCategoryGrid(verdeLabel, "Unissex", "verdeOliva", "unissex", verdeColor);
    
    if (vInf || vBl || vUni) hasAnyItem = true;

    // Seção TERRACOTA
    const terraColor = "#a35e47";
    const terraLabel = "Terracota";
    
    const tInf = renderCategoryGrid(terraLabel, "Infantil", "terracota", "infantil", terraColor);
    const tBl = renderCategoryGrid(terraLabel, "Babylook", "terracota", "babylook", terraColor);
    const tUni = renderCategoryGrid(terraLabel, "Unissex", "terracota", "unissex", terraColor);

    if (tInf || tBl || tUni) hasAnyItem = true;

    if (!hasAnyItem) {
        doc.setFontSize(10);
        doc.setTextColor(150, 0, 0);
        doc.text("Nenhum item registrado neste pedido.", 14, currentY);
        currentY += 10;
    }

    // Rodapé de Valores
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    } else {
      currentY += 5;
    }

    // Valor Total
    doc.setFontSize(12);
    doc.setTextColor(textColor);
    doc.setFont(undefined, 'bold');
    doc.text(`VALOR TOTAL DO PEDIDO: ${order.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, currentY);
    currentY += 10;

    // Observações com suporte a quebra de linha
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

    doc.save(`Pedido_${order.numPedido}.pdf`);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert(`Erro ao gerar PDF do pedido #${order.numPedido}.`);
  }
};

export const generateSizeMatrixPDF = async (orders: Order[], unitPrice: number, stats: Stats | null) => {
  try {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(18);
    doc.text("Relatório de Produção - Matriz de Tamanhos", 148.5, 22, { align: "center" });
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 148.5, 29, { align: "center" });

    const data: any = {};
    const columnTotals: { [size: string]: number } = {};
    let grandTotal = 0;
    const allSizes = [...INFANTIL_SIZES, ...ADULTO_SIZES];

    CATEGORIES.forEach(cat => {
      data[cat] = { rowTotal: 0 };
      COLORS.forEach(color => {
        data[cat][color] = { subTotal: 0 };
        allSizes.forEach(size => {
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
                if (typeof qty === 'number' && allSizes.includes(size)) {
                  data[cat][color][size] += qty;
                  data[cat][color].subTotal += qty;
                  data[cat].rowTotal += qty;
                  columnTotals[size] = (columnTotals[size] || 0) + qty;
                  grandTotal += qty;
                }
              });
            }
          });
        }
      });
    });

    const head = [['Categoria / Cor', ...allSizes, 'TOTAL']];
    const body: any[] = [];
    const primaryColor = '#0ea5e9';

    CATEGORIES.forEach(cat => {
        body.push([{ content: cat.toUpperCase(), colSpan: allSizes.length + 2, styles: { fontStyle: 'bold', fillColor: '#DFDFDF', textColor: '#1E293B' } }]);
        
        COLORS.forEach(color => {
            const rowData = [ color === 'verdeOliva' ? '  Verde Oliva' : '  Terracota' ];
            allSizes.forEach(size => {
                const value = data[cat][color][size];
                rowData.push(value > 0 ? value.toString() : '-');
            });
            rowData.push(data[cat][color].subTotal.toString());
            body.push(rowData);
        });
    });

    (doc as any).autoTable({
        startY: 40,
        head: head,
        body: body,
        theme: 'striped',
        headStyles: { fillColor: primaryColor, textColor: '#FFFFFF', fontStyle: 'bold' },
        foot: [ ['TOTAL GERAL', ...allSizes.map(size => columnTotals[size] || '-'), grandTotal.toString()] ],
        footStyles: { fillColor: '#1e293b', textColor: '#FFFFFF', fontStyle: 'bold', fontSize: 12 },
        styles: { halign: 'center', cellPadding: 2, fontSize: 9 },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    });

    doc.save(`Matriz_de_Tamanhos_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    console.error("Erro ao gerar matriz:", error);
    alert("Erro ao gerar PDF da Matriz de Tamanhos.");
  }
};