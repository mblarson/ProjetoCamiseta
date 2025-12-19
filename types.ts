
export type ColorType = 'verdeOliva' | 'terracota';
export type CategoryType = 'infantil' | 'babylook' | 'unissex';

export interface SizeQuantities {
  [size: string]: number;
}

export interface ColorData {
  infantil: SizeQuantities;
  babylook: SizeQuantities;
  unissex: SizeQuantities;
}

export interface PaymentHistory {
  valor: number;
  data: string;
  timestamp: string;
  liquidacaoId: string;
}

export interface Order {
  docId: string;
  numPedido: string;
  nome: string;
  local: 'Capital' | 'Interior';
  setor: string;
  email: string;
  contato: string;
  observacao?: string;
  data: string;
  statusPagamento: 'Pendente' | 'Parcial' | 'Pago';
  formaPagamento?: string;
  valorPago: number;
  valorTotal: number;
  historicoPagamentos?: PaymentHistory[];
  verdeOliva?: ColorData;
  terracota?: ColorData;
  // Legacy fields
  infantil?: SizeQuantities;
  babylook?: SizeQuantities;
  unissex?: SizeQuantities;
}

export interface Stats {
  qtd_pedidos: number;
  qtd_camisetas: number;
  qtd_infantil: number;
  qtd_babylook: number;
  qtd_unissex: number;
  valor_total: number;
  total_recebido_real: number;
  // Novos campos para o Dashboard detalhado
  pedidos_pagos: number;
  pedidos_pendentes: number;
  pedidos_parciais: number;
  [key: string]: number; 
}

export enum Section {
  Home = 'home',
  Order = 'order',
  Consult = 'consult',
  Admin = 'admin'
}

export enum AdminTab {
  Dashboard = 'dashboard',
  Orders = 'pedidos',
  Payments = 'pagamentos',
  Event = 'evento'
}