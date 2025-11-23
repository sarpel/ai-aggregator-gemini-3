import { APP_TIMEOUTS } from "../../constants";

export const streamCustomLLM = async (
  endpoint: string, // Kept for signature, but used only for CUSTOM provider or ignored
  apiKey: string,   // Kept for signature, used only for CUSTOM provider
  modelName: string,
  messages: { role: string; content: string }[],
  apiStyle: 'OPENAI' | 'ANTHROPIC',
  onUpdate: (text: string, status: any, error?: string, metrics?: { latency: number; tokenCount: number }) => void,
  statusEnums: { synthesizing: any; completed: any; error: any; timeout: any },
  provider: string = 'CUSTOM' // Added provider argument
) => {
  const controller = new AbortController();
  const signal = controller.signal;
  let connectionTimer: any = null;
  let generationTimer: any = null;
  let isActive = true;
  const startTime = Date.now();

  try {
    onUpdate('', statusEnums.synthesizing, undefined, { latency: 0, tokenCount: 0 });

    let proxyUrl = 'http://localhost:3001/api/proxy/openai-compatible';
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let body: any = {
      provider,
      model: modelName,
      messages: messages,
      stream: true
    };

    // --- OPENAI STYLE (OpenAI, Grok, DeepSeek) ---
    if (apiStyle === 'OPENAI') {
      proxyUrl = 'http://localhost:3001/api/proxy/openai-compatible';

      if (provider === 'CUSTOM') {
        // For custom, we might use the endpoint passed in config, 
        // BUT since we are proxying everything through backend for "security" (as requested),
        // we should probably still hit our backend and let backend forward it.
        // However, the backend needs to know the custom endpoint.
        // My backend implementation for 'CUSTOM' expects 'x-custom-api-key' header.
        // It also expects 'endpoint' in body.
        body.endpoint = endpoint;
        if (apiKey) headers['x-custom-api-key'] = apiKey;
      } else {
        // For known providers, backend uses env vars.
        // We don't send API key here.
        body.endpoint = endpoint; // Backend might use this or ignore it depending on provider logic
      }

    }
    // --- ANTHROPIC STYLE (Claude) ---
    else if (apiStyle === 'ANTHROPIC') {
      proxyUrl = 'http://localhost:3001/api/proxy/anthropic';
      // Anthropic proxy in backend handles structure.
      // We just need to pass messages and model.
      // Backend expects { messages, model, stream }
      // My backend implementation for Anthropic is specific to Anthropic API.
      // If provider is CUSTOM but style is ANTHROPIC, my backend might not handle it well 
      // unless I added a generic anthropic proxy. 
      // But for now, let's assume ANTHROPIC style is only for Anthropic provider.
    }

    // 1. Start Connection Timeout
    connectionTimer = setTimeout(() => {
      if (isActive) {
        isActive = false;
        controller.abort();
        onUpdate("Error: Connection timed out", statusEnums.timeout, "Connection Timeout", { latency: Date.now() - startTime, tokenCount: 0 });
      }
    }, APP_TIMEOUTS.connectionTimeoutMs);

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
      signal: signal
    });

    if (!response.ok) {
      let errorMsg = `HTTP error! status: ${response.status}`;
      try {
        const errorBody = await response.text();
        errorMsg += ` - ${errorBody}`;
      } catch (e) { }
      throw new Error(errorMsg);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = '';
    let hasReceivedFirstByte = false;
    let buffer = '';

    if (!reader) throw new Error("No response body");

    while (isActive) {
      const { done, value } = await reader.read();
      if (done) break;

      if (!hasReceivedFirstByte) {
        hasReceivedFirstByte = true;
        clearTimeout(connectionTimer);
        // 2. Start Generation Timeout
        generationTimer = setTimeout(() => {
          if (isActive) {
            isActive = false;
            controller.abort();
            onUpdate(fullText + "\n[TIMEOUT: Generation Limit Reached]", statusEnums.timeout, "Generation Timeout", { latency: Date.now() - startTime, tokenCount: Math.ceil(fullText.length / 4) });
          }
        }, APP_TIMEOUTS.generationTimeoutMs);
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // --- OPENAI STREAM PARSING ---
        if (apiStyle === 'OPENAI') {
          if (trimmedLine.startsWith("data: ")) {
            const jsonStr = trimmedLine.replace("data: ", "").trim();
            if (jsonStr === "[DONE]") break;
            try {
              const json = JSON.parse(jsonStr);
              const content = json.choices?.[0]?.delta?.content || "";
              if (content) {
                fullText += content;
                if (isActive) onUpdate(fullText, statusEnums.synthesizing, undefined, { latency: Date.now() - startTime, tokenCount: Math.ceil(fullText.length / 4) });
              }
            } catch (e) { }
          }
        }
        // --- ANTHROPIC STREAM PARSING ---
        else if (apiStyle === 'ANTHROPIC') {
          if (trimmedLine.startsWith("data: ")) {
            const jsonStr = trimmedLine.replace("data: ", "").trim();
            try {
              const json = JSON.parse(jsonStr);
              if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
                fullText += json.delta.text;
                if (isActive) onUpdate(fullText, statusEnums.synthesizing, undefined, { latency: Date.now() - startTime, tokenCount: Math.ceil(fullText.length / 4) });
              }
            } catch (e) { }
          }
        }
      }
    }

    if (isActive) {
      clearTimeout(generationTimer);
      onUpdate(fullText, statusEnums.completed, undefined, { latency: Date.now() - startTime, tokenCount: Math.ceil(fullText.length / 4) });
    }
  } catch (error: any) {
    if (error.name === 'AbortError' && !isActive) {
    } else {
      console.error(`[Custom Adapter] Stream Error (${apiStyle}):`, error);
      if (isActive) {
        isActive = false;
        clearTimeout(connectionTimer);
        clearTimeout(generationTimer);
        onUpdate(
          `Connection Error: ${error.message}`,
          statusEnums.error,
          error.message || 'Unknown Network Error',
          { latency: Date.now() - startTime, tokenCount: 0 }
        );
      }
    }
  }
};
