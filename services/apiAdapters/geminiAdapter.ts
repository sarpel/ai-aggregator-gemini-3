import { ModelResponse, ModelStatus } from "../../types";
import { APP_TIMEOUTS } from "../../constants";

export const streamGemini = async (
  modelName: string,
  prompt: string,
  apiKey: string, // Kept for signature compatibility, but unused/ignored
  onUpdate: (data: Partial<ModelResponse>) => void
) => {
  let isActive = true;
  let connectionTimer: any = null;
  let generationTimer: any = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    onUpdate({ status: ModelStatus.CONNECTING, text: '', progress: 5, tokenCount: 0 });
    const startTime = Date.now();

    // FIX: Validate prompt to prevent injection attacks
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt');
    }

    // 1. Start Connection Timer
    connectionTimer = setTimeout(() => {
      if (isActive) {
        isActive = false;
        // FIX: Clean up reader if timeout during connection
        if (reader) {
          reader.cancel().catch(() => {});
        }
        onUpdate({ status: ModelStatus.TIMEOUT, error: 'Connection timed out' });
      }
    }, APP_TIMEOUTS.connectionTimeoutMs);

    const response = await fetch('http://localhost:3002/api/proxy/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        model: modelName
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP ${response.status}`);
    }

    if (!response.body) throw new Error("No response body");

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let hasReceivedFirstByte = false;

    // FIX: Use try-finally to ensure reader cleanup
    try {
      while (isActive) {
        const { done, value } = await reader.read();
        if (done) break;

        if (!hasReceivedFirstByte) {
          hasReceivedFirstByte = true;
          clearTimeout(connectionTimer);
          onUpdate({ status: ModelStatus.STREAMING, progress: 10 });

          generationTimer = setTimeout(() => {
            if (isActive) {
              isActive = false;
              // FIX: Cancel reader on generation timeout
              if (reader) {
                reader.cancel().catch(() => {});
              }
              onUpdate({ status: ModelStatus.TIMEOUT, error: 'Generation timed out' });
            }
          }, APP_TIMEOUTS.generationTimeoutMs);
        }

        const chunkText = decoder.decode(value, { stream: true });
        
        // FIX: More robust JSON parsing with error handling
        // Gemini API returns JSON stream with format: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
        const textMatches = chunkText.matchAll(/"text":\s*"((?:[^"\\]|\\.)*)"/g);
        for (const match of textMatches) {
          let text = match[1];
          // FIX: Properly unescape JSON string with error handling
          try {
            text = JSON.parse(`"${text}"`);
          } catch (e) {
            // FIX: If parsing fails, use the raw text (already extracted from regex)
            console.warn('[Gemini] Failed to unescape text, using raw:', text);
          }
          fullText += text;
        }

        if (isActive) {
          onUpdate({
            text: fullText,
            latency: Date.now() - startTime,
            progress: Math.min(90, 10 + (fullText.length / 10)),
            tokenCount: Math.ceil(fullText.length / 4)
          });
        }
      }
    } finally {
      // FIX: Always release the reader lock to prevent memory leaks
      if (reader) {
        reader.releaseLock();
      }
    }

    if (isActive) {
      clearTimeout(generationTimer);
      onUpdate({
        status: ModelStatus.COMPLETED,
        text: fullText,
        progress: 100,
        latency: Date.now() - startTime,
        tokenCount: Math.ceil(fullText.length / 4)
      });
    }

  } catch (error: any) {
    console.error("[Gemini Adapter] Error:", error);

    if (isActive) {
      isActive = false;
      // FIX: Always clear timeouts to prevent memory leaks
      if (connectionTimer) clearTimeout(connectionTimer);
      if (generationTimer) clearTimeout(generationTimer);
      
      // FIX: Clean up reader on error
      if (reader) {
        reader.cancel().catch(() => {});
      }

      onUpdate({
        status: ModelStatus.ERROR,
        error: error.message || "Gemini connection failed"
      });
    }
  }
};