
import { Order } from '../types';
import { DEFAULT_PRICE } from '../constants';

export const generateOrderPDF = (order: Order) => {
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF();

  const formatSetor = (order: Order) => {
    return order.local === 'Capital' && !order.setor.startsWith('SETOR') 
      ? `SETOR ${order.setor}` 
      : order.setor;
  };

  // Main Colors
  const primaryColor = '#6B46C1'; // New Primary Purple
  const textColor = '#1A202C'; // New Text Primary

  // Cabeçalho
  doc.setFontSize(20);
  doc.setTextColor(primaryColor);
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
    headStyles: { fillColor: primaryColor },
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