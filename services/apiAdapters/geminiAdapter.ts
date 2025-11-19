import { GoogleGenAI } from "@google/genai";
import { ModelResponse, ModelStatus, ModelProvider } from "../../types";

export const streamGemini = async (
  prompt: string,
  apiKey: string,
  onUpdate: (data: Partial<ModelResponse>) => void
) => {
  if (!apiKey) {
    onUpdate({ status: ModelStatus.ERROR, error: 'Missing API Key' });
    return;
  }

  try {
    onUpdate({ status: ModelStatus.CONNECTING, text: '', progress: 5 });
    const startTime = Date.now();

    const ai = new GoogleGenAI({ apiKey });
    
    // Using standard generateContentStream as per guidelines
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: prompt }] }],
    });

    let fullText = '';
    onUpdate({ status: ModelStatus.STREAMING, progress: 10 });

    for await (const chunk of responseStream) {
      const chunkText = chunk.text || '';
      fullText += chunkText;
      onUpdate({ 
        text: fullText, 
        latency: Date.now() - startTime,
        progress: Math.min(90, 10 + (fullText.length / 10)) 
      });
    }

    onUpdate({ 
      status: ModelStatus.COMPLETED, 
      text: fullText, 
      progress: 100,
      latency: Date.now() - startTime
    });

  } catch (error: any) {
    console.error("Gemini Error:", error);
    onUpdate({ 
      status: ModelStatus.ERROR, 
      error: error.message || "Gemini connection failed" 
    });
  }
};
