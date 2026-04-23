import type { ApiStyle, ChatMessage, ProxyStreamRequest } from '../../types';

export interface ProxyStreamParams {
  modelId: string;
  apiStyle: ApiStyle;
  messages: ChatMessage[];
  systemPrompt?: string;
  onChunk: (text: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
  abortSignal?: AbortSignal;
}

type ProxyRequestBody = Pick<ProxyStreamRequest, 'modelId' | 'messages' | 'systemPrompt'>;

const PROXY_URLS_BY_API_STYLE: Record<ApiStyle, string> = {
  OPENAI: '/api/proxy/openai',
  ANTHROPIC: '/api/proxy/anthropic',
  GEMINI: '/api/proxy/gemini',
};

const extractChunkText = (apiStyle: ApiStyle, payload: unknown): string => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const eventPayload = payload as {
    error?: unknown;
    text?: unknown;
    type?: unknown;
    delta?: {
      text?: unknown;
    };
    choices?: Array<{
      delta?: {
        content?: unknown;
      };
    }>;
  };

  if (typeof eventPayload.error === 'string') {
    throw new Error(eventPayload.error);
  }

  if (apiStyle === 'OPENAI') {
    return typeof eventPayload.choices?.[0]?.delta?.content === 'string'
      ? eventPayload.choices[0].delta.content
      : '';
  }

  if (apiStyle === 'ANTHROPIC') {
    return eventPayload.type === 'content_block_delta' && typeof eventPayload.delta?.text === 'string'
      ? eventPayload.delta.text
      : '';
  }

  return typeof eventPayload.text === 'string' ? eventPayload.text : '';
};

export const streamViaProxy = async (params: ProxyStreamParams): Promise<void> => {
  const proxyUrl = PROXY_URLS_BY_API_STYLE[params.apiStyle];
  const requestBody: ProxyRequestBody = {
    modelId: params.modelId,
    messages: params.messages,
    ...(params.systemPrompt ? { systemPrompt: params.systemPrompt } : {}),
  };

  let hasCompleted = false;

  try {
    console.log(`[PROXY/${params.modelId}] Sending ${params.apiStyle} stream request...`);
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: params.abortSignal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const errorMessage = errorBody || `Proxy request failed with status ${response.status}`;
      console.error(`[PROXY/${params.modelId}] HTTP ${response.status}: ${errorMessage}`);
      params.onError(errorMessage);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      params.onError('Proxy response did not include a readable stream');
      return;
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let shouldStop = false;

    const processLine = (line: string): void => {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith('data: ')) {
        return;
      }

      const jsonStr = trimmedLine.replace('data: ', '').trim();
      if (jsonStr === '[DONE]') {
        if (!hasCompleted) {
          hasCompleted = true;
          params.onComplete();
        }
        shouldStop = true;
        return;
      }

      try {
        const json = JSON.parse(jsonStr) as unknown;
        const content = extractChunkText(params.apiStyle, json);
        if (content) {
          params.onChunk(content);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to parse proxy stream chunk';
        throw new Error(message);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        processLine(line);
        if (shouldStop) {
          break;
        }
      }

      if (shouldStop) {
        break;
      }
    }

    if (buffer.trim()) {
      processLine(buffer);
    }

    if (!hasCompleted) {
      hasCompleted = true;
      params.onComplete();
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log(`[PROXY/${params.modelId}] Stream aborted by user`);
      return;
    }

    const message = error instanceof Error ? error.message : 'Unknown proxy streaming error';
    console.error(`[PROXY/${params.modelId}] Stream error:`, message);
    params.onError(message);
  }
};
