
import { APP_TIMEOUTS } from "../../constants";

export const streamCustomLLM = async (
  endpoint: string,
  apiKey: string,
  modelName: string,
  messages: { role: string; content: string }[],
  apiStyle: 'OPENAI' | 'ANTHROPIC',
  onUpdate: (text: string, status: any, error?: string) => void,
  statusEnums: { synthesizing: any; completed: any; error: any; timeout: any }
) => {
  const controller = new AbortController();
  const signal = controller.signal;
  let connectionTimer: any = null;
  let generationTimer: any = null;
  let isActive = true;

  try {
    onUpdate('', statusEnums.synthesizing);

    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let body: any = {};

    // --- OPENAI STYLE ---
    if (apiStyle === 'OPENAI') {
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      body = {
        model: modelName,
        messages: messages,
        stream: true,
      };
    } 
    // --- ANTHROPIC STYLE ---
    else if (apiStyle === 'ANTHROPIC') {
      if (apiKey) headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      
      const systemMsg = messages.find(m => m.role === 'system');
      const otherMessages = messages.filter(m => m.role !== 'system');
      
      body = {
        model: modelName,
        messages: otherMessages,
        max_tokens: 4096,
        stream: true,
      };
      
      if (systemMsg) {
        body.system = systemMsg.content;
      }
    }

    // 1. Start Connection Timeout
    connectionTimer = setTimeout(() => {
        if (isActive) {
            isActive = false;
            controller.abort();
            onUpdate("Error: Connection timed out", statusEnums.timeout, "Connection Timeout");
        }
    }, APP_TIMEOUTS.connectionTimeoutMs);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
      signal: signal
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = '';
    let hasReceivedFirstByte = false;

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
                  onUpdate(fullText + "\n[TIMEOUT: Generation Limit Reached]", statusEnums.timeout, "Generation Timeout");
              }
          }, APP_TIMEOUTS.generationTimeoutMs);
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.trim()) continue;

        if (apiStyle === 'OPENAI') {
          if (line.startsWith("data: ")) {
            const jsonStr = line.replace("data: ", "").trim();
            if (jsonStr === "[DONE]") break;
            try {
              const json = JSON.parse(jsonStr);
              const content = json.choices?.[0]?.delta?.content || "";
              fullText += content;
              if (isActive) onUpdate(fullText, statusEnums.synthesizing);
            } catch (e) {}
          }
        } else if (apiStyle === 'ANTHROPIC') {
           if (line.startsWith("data: ")) {
             const jsonStr = line.replace("data: ", "").trim();
             try {
               const json = JSON.parse(jsonStr);
               if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
                 fullText += json.delta.text;
                 if (isActive) onUpdate(fullText, statusEnums.synthesizing);
               }
             } catch (e) {}
          }
        }
      }
    }

    if (isActive) {
        clearTimeout(generationTimer);
        onUpdate(fullText, statusEnums.completed);
    }
  } catch (error: any) {
    // Check if it's an abort error (timeout) which we handled, otherwise it's a network error
    if (error.name === 'AbortError' && !isActive) {
       // Already handled by the timeout callback
    } else {
        console.error(`[Custom Adapter] Stream Error (${apiStyle}):`, error);
        if (isActive) {
            isActive = false;
            clearTimeout(connectionTimer);
            clearTimeout(generationTimer);
            onUpdate(
                `Connection Error: ${error.message}`, 
                statusEnums.error, 
                error.message || 'Unknown Network Error'
            );
        }
    }
  }
};
