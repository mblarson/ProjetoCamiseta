
import { Order, Stats } from '../types';
import { DEFAULT_PRICE, INFANTIL_SIZES, ADULTO_SIZES } from '../constants';

const CATEGORIES = ['infantil', 'babylook', 'unissex'] as const;
const COLORS = ['verdeOliva', 'terracota'] as const;

export const generateOrderPDF = async (order: Order) => {
  try {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();

    // REMOVED: Logo image logic has been removed as requested to fix generation errors.

    const formatSetor = (order: Order) => {
      return order.local === 'Capital' && !order.setor.startsWith('SETOR') 
        ? `SETOR ${order.setor}` 
        : order.setor;
    };

    // Main Colors
    const primaryColor = '#2563EB'; // New Primary Blue
    const textColor = '#1A202C'; // Standard Dark Text for PDF Body

    // Cabeçalho - Positions adjusted after logo removal
    doc.setFontSize(20);
    doc.setTextColor(textColor);
    doc.text("UMADEMATS - JUBILEU DE OURO", 105, 20, { align: "center" });
    
    doc.setFontSize(14);
    doc.setTextColor(textColor);
    doc.text(`PEDIDO #${order.numPedido}`, 105, 28, { align: "center" });

    // Informações do Líder - Positions adjusted after logo removal
    const infoStartY = 40;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Líder: ${order.nome}`, 14, infoStartY);
    doc.text(`Localização: ${order.local} - ${formatSetor(order)}`, 14, infoStartY + 7);
    doc.text(`E-mail: ${order.email}`, 14, infoStartY + 14);
    doc.text(`Contato: ${order.contato}`, 14, infoStartY + 21);
    doc.text(`Data: ${new Date(order.data).toLocaleDateString('pt-BR')}`, 14, infoStartY + 28);

    const tableData: any[] = [];

    const addRows = (label: string, colorData: any) => {
      if (!colorData) return;
      ['infantil', 'babylook', 'unissex'].forEach(cat => {
        const sizes = colorData[cat];
        if (sizes) {
          Object.entries(sizes).forEach(([size, qty]) => {
            if ((qty as number) > 0) {
              tableData.push([label, cat.toUpperCase(), size, qty]);
            }
          });
        }
      });
    };

    addRows("VERDE OLIVA", order.verdeOliva);
    addRows("TERRACOTA", order.terracota);

    // Detalhamento do Pedido (Tabela) - Positions adjusted after logo removal
    (doc as any).autoTable({
      startY: 75,
      head: [['Cor', 'Categoria', 'Tamanho', 'Qtd']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: '#FFFFFF' }, // Blue background, white text
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`VALOR TOTAL: ${order.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, finalY);

    if (order.observacao) {
      doc.setFontSize(10);
      doc.text(`OBSERVAÇÕES: ${order.observacao}`, 14, finalY + 10);
    }

    doc.save(`Pedido_${order.numPedido}.pdf`);
  } catch (error) {
    console.error("--- INÍCIO DO LOG DE ERRO PDF INDIVIDUAL ---");
    console.error(`Falha ao gerar o PDF para o Pedido #${order.numPedido}. Motivo:`, error);
    if (error instanceof Error) {
        console.error("Mensagem de Erro:", error.message);
        console.error("Rastreamento de Pilha:", error.stack);
    }
    console.error("Dados do pedido no momento do erro:", JSON.stringify(order, null, 2));
    console.error("--- FIM DO LOG DE ERRO PDF INDIVIDUAL ---");
    alert(`Ocorreu um erro ao gerar o PDF para o Pedido #${order.numPedido}. Por favor, verifique o console do navegador (F12) para mais detalhes técnicos.`);
  }
};

export const generateSizeMatrixPDF = async (orders: Order[], unitPrice: number, stats: Stats | null) => {
  try {
    // 1. Calculate matrix data
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

    // 2. Initialize jsPDF
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });

    // REMOVED: Logo image logic has been removed as requested to fix generation errors.

    doc.setFontSize(18);
    doc.text("Relatório de Produção - Matriz de Tamanhos", 148.5, 22, { align: "center" });
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 148.5, 29, { align: "center" });

    // 3. Prepare data for autoTable
    const head = [['Categoria / Cor', ...allSizes, 'TOTAL']];
    const body: any[] = [];
    const primaryColor = '#2563EB';

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

    // 4. Create the main table
    (doc as any).autoTable({
        startY: 40,
        head: head,
        body: body,
        theme: 'striped',
        headStyles: { fillColor: primaryColor, textColor: '#FFFFFF', fontStyle: 'bold' },
        foot: [ ['TOTAL GERAL', ...allSizes.map(size => columnTotals[size] || '-'), grandTotal.toString()] ],
        footStyles: { fillColor: '#1E293B', textColor: '#FFFFFF', fontStyle: 'bold', fontSize: 12 },
        styles: { halign: 'center', cellPadding: 2, fontSize: 9 },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    });

    // 5. Add summary tables side-by-side
    const mainTableFinalY = (doc as any).lastAutoTable.finalY;
    const summaryStartY = mainTableFinalY + 20;

    // Table 1: Category Summary
    doc.setFontSize(14);
    doc.setTextColor('#1E293B');
    doc.text("Resumo por Categoria", 14, mainTableFinalY + 15);
    
    const summaryBody = CATEGORIES.map(cat => [cat.toUpperCase(), data[cat].rowTotal.toString()]);
    
    (doc as any).autoTable({
        startY: summaryStartY,
        head: [['Categoria', 'Total de Peças']],
        body: summaryBody,
        theme: 'grid',
        headStyles: { fillColor: '#64748B', textColor: '#FFFFFF', fontStyle: 'bold' },
        styles: { halign: 'center' },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
        tableWidth: 'wrap',
        margin: { left: 14 }
    });

    const categorySummaryTable = (doc as any).lastAutoTable;

    if (stats && categorySummaryTable) {
        // Unify the financial data into a single table.
        const financialBody = [
            ['Valor Unitário', unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
            ['Total Arrecadado', stats.total_recebido_real.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]
        ];

        // Robustly calculate the start position for the second table.
        const tableWidth = categorySummaryTable.width ?? categorySummaryTable.columns.reduce((acc: number, col: any) => acc + col.width, 0);
        const startX = (categorySummaryTable.startX ?? 14) + tableWidth + 10;

        // Add a single title for the financial summary.
        doc.setFontSize(14);
        doc.setTextColor('#1E293B');
        doc.text("Resumo Financeiro", startX, mainTableFinalY + 15);

        // Draw the single financial table side-by-side with the first.
        (doc as any).autoTable({
            startY: summaryStartY, // Align vertically with the category table
            body: financialBody,
            theme: 'grid',
            // No header needed as we have a text title.
            columnStyles: { 
                0: { halign: 'left', fontStyle: 'bold' },
                1: { halign: 'right' }
            },
            tableWidth: 'wrap',
            margin: { left: startX }
        });
    }

    // 6. Save the PDF
    doc.save(`Matriz_de_Tamanhos_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    console.error("--- INÍCIO DO LOG DE ERRO PDF GERAL ---");
    console.error("Falha ao gerar o PDF da Matriz de Tamanhos. Motivo:", error);
    if (error instanceof Error) {
        console.error("Mensagem de Erro:", error.message);
        console.error("Rastreamento de Pilha:", error.stack);
    }
    console.error("Dados dos pedidos no momento do erro:", JSON.stringify(orders, null, 2));
    console.error("--- FIM DO LOG DE ERRO PDF GERAL ---");
    alert("Ocorreu um erro ao gerar o PDF da Matriz de Tamanhos. Por favor, verifique o console do navegador (F12) para mais detalhes técnicos.");
  }
};
