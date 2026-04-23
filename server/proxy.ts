import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import type { Request, Response } from 'express';

import { getApiKey, getModelConfigs } from './db.js';

type FlushableResponse = Response & { flush?: () => void };

interface ProxyRequest {
  modelId: string;
  messages: { role: string; content: string }[];
  systemPrompt?: string;
}

function setSseHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

function writeSseError(res: Response, error: string): void {
  res.write(`data: ${JSON.stringify({ error })}\n\n`);
  res.end();
}

function flushResponse(res: FlushableResponse): void {
  res.flush?.();
}

async function pipeUpstreamBodyToResponse(
  body: ReadableStream<Uint8Array>,
  res: FlushableResponse,
): Promise<void> {
  const reader = body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    res.write(value);
    flushResponse(res);
  }
}

export async function handleOpenAIProxy(
  req: Request<object, object, ProxyRequest>,
  res: FlushableResponse,
): Promise<void> {
  let apiKey: string | null;
  try {
    apiKey = getApiKey(req.body.modelId);
  } catch {
    res.status(500).json({ error: 'Failed to retrieve API key' });
    return;
  }

  if (!apiKey) {
    res.status(400).json({ error: 'API key not configured for model' });
    return;
  }

  const modelConfig = getModelConfigs().find((m) => m.id === req.body.modelId);
  if (!modelConfig) {
    res.status(400).json({ error: `Unknown model: ${req.body.modelId}` });
    return;
  }

  const controller = new AbortController();
  req.on('close', () => {
    console.log(`[PROXY/${req.body.modelId}] Client disconnected, aborting upstream request`);
    controller.abort();
  });

  setSseHeaders(res);

  const systemPrompt = req.body.systemPrompt;
  const messagesWithSystem = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...req.body.messages]
    : req.body.messages;

  const upstreamBody = {
    model: modelConfig.modelName,
    messages: messagesWithSystem,
    stream: true,
  };

  try {
    console.log(`[PROXY/OPENAI] Streaming ${modelConfig.modelName} → ${modelConfig.endpoint}`);
    const response = await fetch(modelConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
      signal: req.socket.destroyed ? AbortSignal.abort() : controller.signal,
    });

    console.log(`[PROXY/OPENAI] Upstream responded: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(`[PROXY/OPENAI] Upstream error ${response.status}: ${errorBody}`);
      writeSseError(res, `Upstream error: ${response.status}`);
      return;
    }

    if (!response.body) {
      console.warn(`[PROXY/OPENAI] No response body from upstream`);
      res.end();
      return;
    }

    await pipeUpstreamBodyToResponse(response.body, res);
    console.log(`[PROXY/OPENAI] Stream complete for ${req.body.modelId}`);
    res.end();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[PROXY/OPENAI] Request aborted for ${req.body.modelId}`);
    } else {
      console.error(`[PROXY/OPENAI] Error for ${req.body.modelId}:`, error);
    }
    if (!res.writableEnded) {
      const message = error instanceof Error ? error.message : 'Unknown proxy error';
      writeSseError(res, message);
    }
  }
}

export async function handleAnthropicProxy(
  req: Request<object, object, ProxyRequest>,
  res: FlushableResponse,
): Promise<void> {
  let apiKey: string | null;
  try {
    apiKey = getApiKey(req.body.modelId);
  } catch {
    res.status(500).json({ error: 'Failed to retrieve API key' });
    return;
  }

  if (!apiKey) {
    res.status(400).json({ error: 'API key not configured for model' });
    return;
  }

  const modelConfig = getModelConfigs().find((m) => m.id === req.body.modelId);
  if (!modelConfig) {
    res.status(400).json({ error: `Unknown model: ${req.body.modelId}` });
    return;
  }

  const controller = new AbortController();
  req.on('close', () => {
    console.log(`[PROXY/${req.body.modelId}] Client disconnected, aborting upstream request`);
    controller.abort();
  });

  setSseHeaders(res);

  const systemMsg = req.body.messages.find((message) => message.role === 'system');
  const systemContent = req.body.systemPrompt ?? systemMsg?.content;
  const otherMessages = req.body.messages.filter((message) => message.role !== 'system');
  const upstreamBody = {
    model: modelConfig.modelName,
    messages: otherMessages,
    max_tokens: 8192,
    stream: true,
    ...(systemContent ? { system: systemContent } : {}),
  };

  try {
    console.log(`[PROXY/ANTHROPIC] Streaming ${modelConfig.modelName} → ${modelConfig.endpoint}`);
    const response = await fetch(modelConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(upstreamBody),
      signal: req.socket.destroyed ? AbortSignal.abort() : controller.signal,
    });

    console.log(`[PROXY/ANTHROPIC] Upstream responded: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(`[PROXY/ANTHROPIC] Upstream error ${response.status}: ${errorBody}`);
      writeSseError(res, `Upstream error: ${response.status}`);
      return;
    }

    if (!response.body) {
      console.warn(`[PROXY/ANTHROPIC] No response body from upstream`);
      res.end();
      return;
    }

    await pipeUpstreamBodyToResponse(response.body, res);
    console.log(`[PROXY/ANTHROPIC] Stream complete for ${req.body.modelId}`);
    res.end();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[PROXY/ANTHROPIC] Request aborted for ${req.body.modelId}`);
    } else {
      console.error(`[PROXY/ANTHROPIC] Error for ${req.body.modelId}:`, error);
    }
    if (!res.writableEnded) {
      const message = error instanceof Error ? error.message : 'Unknown proxy error';
      writeSseError(res, message);
    }
  }
}

export async function handleGeminiProxy(
  req: Request<object, object, ProxyRequest>,
  res: FlushableResponse,
): Promise<void> {
  let apiKey: string | null;
  try {
    apiKey = getApiKey(req.body.modelId);
  } catch {
    res.status(500).json({ error: 'Failed to retrieve API key' });
    return;
  }

  if (!apiKey) {
    res.status(400).json({ error: 'API key not configured for model' });
    return;
  }

  const modelConfig = getModelConfigs().find((m) => m.id === req.body.modelId);
  if (!modelConfig) {
    res.status(400).json({ error: `Unknown model: ${req.body.modelId}` });
    return;
  }

  const ai = new GoogleGenAI({ apiKey });
  const systemPrompt = req.body.systemPrompt;
  const systemMessageText = req.body.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');

  const contents = req.body.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'user' ? 'user' : 'model',
      parts: [{ text: message.content }],
    }));

  const systemInstruction = systemPrompt || systemMessageText || undefined;
  const config = systemInstruction ? { systemInstruction } : undefined;

  setSseHeaders(res);

  let isClosed = req.socket.destroyed;
  let responseIterator: AsyncGenerator<GenerateContentResponse> | null = null;

  req.on('close', () => {
    console.log(`[PROXY/GEMINI] Client disconnected for ${req.body.modelId}`);
    isClosed = true;
    if (responseIterator && typeof responseIterator.return === 'function') {
      void responseIterator.return(undefined);
    }
  });

  try {
    console.log(`[PROXY/GEMINI] Streaming ${modelConfig.modelName}`);
    const responseStream = await ai.models.generateContentStream({
      model: modelConfig.modelName,
      contents,
      ...(config ? { config } : {}),
    });
    responseIterator = responseStream;

    for await (const chunk of responseIterator) {
      if (isClosed) {
        break;
      }

      res.write(`data: ${JSON.stringify({ text: chunk.text || '' })}\n\n`);
      flushResponse(res);
    }

    if (!isClosed) {
      console.log(`[PROXY/GEMINI] Stream complete for ${req.body.modelId}`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log(`[PROXY/GEMINI] Request aborted for ${req.body.modelId}`);
    } else {
      console.error(`[PROXY/GEMINI] Error for ${req.body.modelId}:`, error);
    }
    if (!res.writableEnded) {
      const message = error instanceof Error ? error.message : 'Unknown proxy error';
      writeSseError(res, message);
    }
  }
}
