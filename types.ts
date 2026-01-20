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
  lote: number; // Novo campo
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

// Fix: Added missing Confirmation interface to resolve import error in ConfirmationTab.tsx
export interface Confirmation {
  docId: string;
  type: 'Capital' | 'Interior';
  status: 'none' | 'confirmed' | 'pending';
  lote?: number;
  lastUpdated?: string;
}

export interface BatchStats {
  qtd_pedidos: number;
  qtd_camisetas: number;
  valor_total: number;
}

export interface Stats {
  qtd_pedidos: number; // Global
  qtd_camisetas: number; // Global
  qtd_infantil: number;
  qtd_babylook: number;
  qtd_unissex: number;
  valor_total: number; // Global Previsto
  total_recebido_real: number; // Global Recebido
  // Novos campos para o Dashboard detalhado
  pedidos_pagos: number;
  pedidos_pendentes: number;
  pedidos_parciais: number;
  batches?: Record<number, BatchStats>; // Estatísticas por lote
  [key: string]: any; 
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
  Statistics = 'estatisticas',
  Event = 'evento'
}