import { GoogleGenAI } from "@google/genai";
import { Stats } from '../types';

export const analyzeSales = async (stats: Stats): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Analyze the following sales data for a T-shirt event. provide insights on performance, most popular sizes/categories, and projected revenue. Keep it encouraging but professional. 
  Data: ${JSON.stringify(stats)}`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // FIX: Access the 'text' property directly instead of calling it as a function.
    return response.text || "Não foi possível gerar a análise no momento.";
  } catch (error) {
    console.error("AI Error:", error);
    return "Erro ao processar análise inteligente.";
  }
};