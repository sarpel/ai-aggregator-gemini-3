
import { GoogleGenAI } from "@google/genai";
import { ModelResponse, ModelStatus, ModelProvider } from "../../types";
import { APP_TIMEOUTS } from "../../constants";

export const streamGemini = async (
  prompt: string,
  apiKey: string,
  onUpdate: (data: Partial<ModelResponse>) => void
) => {
  if (!apiKey) {
    onUpdate({ status: ModelStatus.ERROR, error: 'Missing API Key' });
    return;
  }

  let isActive = true; // Guard to prevent updates after timeout/error
  let connectionTimer: any = null;
  let generationTimer: any = null;

  try {
    onUpdate({ status: ModelStatus.CONNECTING, text: '', progress: 5 });
    const startTime = Date.now();

    const ai = new GoogleGenAI({ apiKey });
    
    // 1. Start Connection Timer
    connectionTimer = setTimeout(() => {
      if (isActive) {
        isActive = false;
        onUpdate({ status: ModelStatus.TIMEOUT, error: 'Connection timed out' });
      }
    }, APP_TIMEOUTS.connectionTimeoutMs);

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: prompt }] }],
    });

    let fullText = '';
    let hasReceivedFirstByte = false;

    for await (const chunk of responseStream) {
      if (!isActive) break;

      if (!hasReceivedFirstByte) {
        // 2. First Byte Received: Clear Connection Timer, Start Generation Timer
        hasReceivedFirstByte = true;
        clearTimeout(connectionTimer);
        onUpdate({ status: ModelStatus.STREAMING, progress: 10 });
        
        generationTimer = setTimeout(() => {
           if (isActive) {
             isActive = false;
             onUpdate({ status: ModelStatus.TIMEOUT, error: 'Generation timed out' });
           }
        }, APP_TIMEOUTS.generationTimeoutMs);
      }

      const chunkText = chunk.text || '';
      fullText += chunkText;
      
      if (isActive) {
        onUpdate({ 
          text: fullText, 
          latency: Date.now() - startTime,
          progress: Math.min(90, 10 + (fullText.length / 10)) 
        });
      }
    }

    if (isActive) {
        clearTimeout(generationTimer);
        onUpdate({ 
        status: ModelStatus.COMPLETED, 
        text: fullText, 
        progress: 100,
        latency: Date.now() - startTime
        });
    }

  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (isActive) {
        isActive = false;
        clearTimeout(connectionTimer);
        clearTimeout(generationTimer);
        onUpdate({ 
        status: ModelStatus.ERROR, 
        error: error.message || "Gemini connection failed" 
        });
    }
  }
};
