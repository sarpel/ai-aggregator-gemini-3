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

  try {
    onUpdate({ status: ModelStatus.CONNECTING, text: '', progress: 5, tokenCount: 0 });
    const startTime = Date.now();

    // 1. Start Connection Timer
    connectionTimer = setTimeout(() => {
      if (isActive) {
        isActive = false;
        onUpdate({ status: ModelStatus.TIMEOUT, error: 'Connection timed out' });
      }
    }, APP_TIMEOUTS.connectionTimeoutMs);

    const response = await fetch('http://localhost:3001/api/proxy/gemini', {
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

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let hasReceivedFirstByte = false;

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
            onUpdate({ status: ModelStatus.TIMEOUT, error: 'Generation timed out' });
          }
        }, APP_TIMEOUTS.generationTimeoutMs);
      }

      const chunkText = decoder.decode(value, { stream: true });
      // The backend proxy might send raw text or JSON chunks depending on implementation.
      // My backend implementation pipes the raw stream from Gemini REST API.
      // Gemini REST API returns JSON chunks: [{ candidates: [{ content: { parts: [{ text: "..." }] } }] }]
      // Wait, my backend implementation for Gemini uses:
      // `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}`
      // This returns a JSON stream. I need to parse it here.

      // Simple parsing for the JSON stream (it comes as multiple JSON objects, potentially separated or in array)
      // Actually, standard fetch stream from Gemini is a list of JSON objects.
      // I'll accumulate text and try to parse.

      // For simplicity in this "fix", I'll assume the backend forwards the raw JSON stream.
      // I need to parse the JSON chunks to extract text.
      // However, parsing streamed JSON is tricky.
      // Let's try a simpler approach: Regex to find "text": "..."

      const textMatches = chunkText.matchAll(/"text":\s*"((?:[^"\\]|\\.)*)"/g);
      for (const match of textMatches) {
        let text = match[1];
        // Unescape JSON string
        try {
          text = JSON.parse(`"${text}"`);
        } catch (e) {
          // fallback if already unescaped or simple
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
      clearTimeout(connectionTimer);
      clearTimeout(generationTimer);

      onUpdate({
        status: ModelStatus.ERROR,
        error: error.message || "Gemini connection failed"
      });
    }
  }
};