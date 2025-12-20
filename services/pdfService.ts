
import { Order } from '../types';
import { DEFAULT_PRICE, INFANTIL_SIZES, ADULTO_SIZES } from '../constants';

const CATEGORIES = ['infantil', 'babylook', 'unissex'] as const;
const COLORS = ['verdeOliva', 'terracota'] as const;

export const generateOrderPDF = (order: Order) => {
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF();

  const formatSetor = (order: Order) => {
    return order.local === 'Capital' && !order.setor.startsWith('SETOR') 
      ? `SETOR ${order.setor}` 
      : order.setor;
  };

  // Main Colors
  const primaryColor = '#2563EB'; // New Primary Blue
  const textColor = '#1A202C'; // Standard Dark Text for PDF Body

  // Cabeçalho
  doc.setFontSize(20);
  doc.setTextColor(textColor); // Use dark text for title
  doc.text("UMADEMATS - JUBILEU DE OURO", 105, 20, { align: "center" });
  
  doc.setFontSize(14);
  doc.setTextColor(textColor);
  doc.text(`PEDIDO #${order.numPedido}`, 105, 30, { align: "center" });

  // Informações do Líder
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Líder: ${order.nome}`, 14, 45);
  doc.text(`Localização: ${order.local} - ${formatSetor(order)}`, 14, 52);
  doc.text(`E-mail: ${order.email}`, 14, 59);
  doc.text(`Contato: ${order.contato}`, 14, 66);
  doc.text(`Data: ${new Date(order.data).toLocaleDateString('pt-BR')}`, 14, 73);

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

  // Detalhamento do Pedido (Tabela)
  (doc as any).autoTable({
    startY: 85,
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
};

export const generateSizeMatrixPDF = (orders: Order[]) => {
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

    doc.setFontSize(18);
    doc.text("Relatório de Produção - Matriz de Tamanhos", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 29);

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
        
        // FIX: Cast styles to any in the initial element to prevent overly strict type inference for subsequent pushes. This resolves errors on lines 149 and 151.
        const subtotalRow = [{ content: `Subtotal ${cat}`, styles: { fontStyle: 'bold', halign: 'right' } as any }];
        allSizes.forEach(size => {
            const sub = (data[cat]['verdeOliva'][size] || 0) + (data[cat]['terracota'][size] || 0);
            subtotalRow.push({ content: sub > 0 ? sub.toString() : '-', styles: { fontStyle: 'bold' }});
        });
        subtotalRow.push({ content: data[cat].rowTotal.toString(), styles: { fontStyle: 'bold', fillColor: 'rgba(37, 99, 235, 0.1)' }});
        body.push(subtotalRow);
    });

    // 4. Create the table
    (doc as any).autoTable({
        startY: 35,
        head: head,
        body: body,
        theme: 'striped',
        headStyles: { fillColor: primaryColor, textColor: '#FFFFFF', fontStyle: 'bold' },
        foot: [ ['TOTAL GERAL', ...allSizes.map(size => columnTotals[size] || '-'), grandTotal.toString()] ],
        footStyles: { fillColor: '#1E293B', textColor: '#FFFFFF', fontStyle: 'bold', fontSize: 12 },
        styles: { halign: 'center', cellPadding: 2, fontSize: 9 },
        columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    });

    // 5. Save the PDF
    doc.save(`Matriz_de_Tamanhos_${new Date().toISOString().slice(0, 10)}.pdf`);
};
