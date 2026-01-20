import { GoogleGenAI } from "@google/genai";
import { Stats } from '../types';

export const analyzeSales = async (stats: Stats): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Limpamos os dados antes de enviar para economizar tokens e focar no essencial
  const cleanStats = {
    qtd_pedidos: stats.qtd_pedidos,
    qtd_camisetas: stats.qtd_camisetas,
    valor_total: stats.valor_total,
    recebido: stats.total_recebido_real,
    lotes: stats.batches ? Object.keys(stats.batches).length : 1,
    status: {
      pagos: stats.pedidos_pagos,
      pendentes: stats.pedidos_pendentes,
      parciais: stats.pedidos_parciais
    }
  };

  const prompt = `Analise os seguintes dados de vendas de camisetas para o evento UMADEMATS (Jubileu de Ouro). 
  Forneça insights encorajadores e profissionais sobre o desempenho, adesão por lotes e projeção financeira. 
  Mantenha o tom motivador para a liderança.
  
  Dados: ${JSON.stringify(cleanStats)}`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    return response.text || "A análise inteligente não retornou dados. Tente novamente em instantes.";
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return "Ocorreu um erro ao processar a análise com IA. Verifique as configurações da API.";
  }
};