import { GoogleGenAI } from '@google/genai';
import type { Request, Response } from 'express';

import { getApiKey } from './db.js';

type FlushableResponse = Response & { flush?: () => void };

interface ProxyRequest {
  modelId: string;
  endpoint?: string;
  modelName: string;
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
  const apiKey = getApiKey(req.body.modelId);

  if (!apiKey) {
    res.status(400).json({ error: 'API key not configured for model' });
    return;
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  setSseHeaders(res);

  const upstreamBody = {
    model: req.body.modelName,
    messages: req.body.messages,
    stream: true,
  };

  try {
    const response = await fetch(req.body.endpoint ?? '', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
      signal: req.socket.destroyed ? AbortSignal.abort() : controller.signal,
    });

    if (!response.ok) {
      writeSseError(res, `Upstream error: ${response.status}`);
      return;
    }

    if (!response.body) {
      res.end();
      return;
    }

    await pipeUpstreamBodyToResponse(response.body, res);

    res.end();
  } catch (error) {
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
  const apiKey = getApiKey(req.body.modelId);

  if (!apiKey) {
    res.status(400).json({ error: 'API key not configured for model' });
    return;
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  setSseHeaders(res);

  const systemMsg = req.body.messages.find((message) => message.role === 'system');
  const otherMessages = req.body.messages.filter((message) => message.role !== 'system');
  const upstreamBody = {
    model: req.body.modelName,
    messages: otherMessages,
    max_tokens: 8192,
    stream: true,
    ...(systemMsg ? { system: systemMsg.content } : {}),
  };

  try {
    const response = await fetch(req.body.endpoint ?? '', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(upstreamBody),
      signal: req.socket.destroyed ? AbortSignal.abort() : controller.signal,
    });

    if (!response.ok) {
      writeSseError(res, `Upstream error: ${response.status}`);
      return;
    }

    if (!response.body) {
      res.end();
      return;
    }

    await pipeUpstreamBodyToResponse(response.body, res);

    res.end();
  } catch (error) {
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
  const apiKey = getApiKey(req.body.modelId);

  if (!apiKey) {
    res.status(400).json({ error: 'API key not configured for model' });
    return;
  }

  const ai = new GoogleGenAI({ apiKey });
  const contents = req.body.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'user' ? 'user' : 'model',
      parts: [{ text: message.content }],
    }));

  setSseHeaders(res);

  let isClosed = req.socket.destroyed;
  let responseIterator: AsyncIterator<{ text?: string }> | null = null;

  req.on('close', () => {
    isClosed = true;
    if (responseIterator && typeof responseIterator.return === 'function') {
      void responseIterator.return(undefined);
    }
  });

  try {
    const responseStream = await ai.models.generateContentStream({
      model: req.body.modelName,
      contents,
    });
    responseIterator = responseStream[Symbol.asyncIterator]();

    for await (const chunk of responseStream) {
      if (isClosed) {
        break;
      }

      res.write(`data: ${JSON.stringify({ text: chunk.text || '' })}\n\n`);
      flushResponse(res);
    }

    if (!isClosed) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    if (!res.writableEnded) {
      const message = error instanceof Error ? error.message : 'Unknown proxy error';
      writeSseError(res, message);
    }
  }
}
