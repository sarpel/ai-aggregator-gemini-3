
import { APP_TIMEOUTS } from "../../constants";

export const streamCustomLLM = async (
  endpoint: string,
  apiKey: string,
  modelName: string,
  messages: { role: string; content: string }[],
  apiStyle: 'OPENAI' | 'ANTHROPIC',
  onUpdate: (text: string, status: any, error?: string, metrics?: { latency: number; tokenCount: number }) => void,
  statusEnums: { synthesizing: any; completed: any; error: any; timeout: any }
) => {
  const controller = new AbortController();
  const signal = controller.signal;
  let connectionTimer: any = null;
  let generationTimer: any = null;
  let isActive = true;
  const startTime = Date.now();

  try {
    onUpdate('', statusEnums.synthesizing, undefined, { latency: 0, tokenCount: 0 });

    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let body: any = {};

    // --- OPENAI STYLE (OpenAI, Grok, DeepSeek) ---
    if (apiStyle === 'OPENAI') {
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      
      body = {
        model: modelName,
        messages: messages,
        stream: true,
      };
    } 
    // --- ANTHROPIC STYLE (Claude) ---
    else if (apiStyle === 'ANTHROPIC') {
      if (apiKey) headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      
      // Anthropic API requires 'system' to be a top-level parameter, not in messages
      const systemMsg = messages.find(m => m.role === 'system');
      const otherMessages = messages.filter(m => m.role !== 'system');
      
      body = {
        model: modelName,
        messages: otherMessages,
        max_tokens: 8192, // Required by Anthropic
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
            onUpdate("Error: Connection timed out", statusEnums.timeout, "Connection Timeout", { latency: Date.now() - startTime, tokenCount: 0 });
        }
    }, APP_TIMEOUTS.connectionTimeoutMs);

    const response = await fetch(endpoint, {
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
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = '';
    let hasReceivedFirstByte = false;
    let buffer = ''; // Buffer for handling split chunks

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

      // Decode current chunk and append to buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines from buffer
      const lines = buffer.split('\n');
      // The last element is either an empty string (if buffer ended with \n) 
      // or an incomplete line. We keep it in the buffer for the next chunk.
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
            } catch (e) {
                // Ignore JSON parse errors for partial chunks (though buffer should handle most)
            }
          }
        } 
        // --- ANTHROPIC STREAM PARSING ---
        else if (apiStyle === 'ANTHROPIC') {
           if (trimmedLine.startsWith("data: ")) {
             const jsonStr = trimmedLine.replace("data: ", "").trim();
             try {
               const json = JSON.parse(jsonStr);
               // Anthropic stream event types
               if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
                 fullText += json.delta.text;
                 if (isActive) onUpdate(fullText, statusEnums.synthesizing, undefined, { latency: Date.now() - startTime, tokenCount: Math.ceil(fullText.length / 4) });
               }
             } catch (e) {
                 // Ignore parse errors
             }
          }
        }
      }
    }

    if (isActive) {
        clearTimeout(generationTimer);
        onUpdate(fullText, statusEnums.completed, undefined, { latency: Date.now() - startTime, tokenCount: Math.ceil(fullText.length / 4) });
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
                error.message || 'Unknown Network Error',
                { latency: Date.now() - startTime, tokenCount: 0 }
            );
        }
    }
  }
};
