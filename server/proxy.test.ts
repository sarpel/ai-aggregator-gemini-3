import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./db.js', () => ({
  getApiKey: vi.fn(),
  getModelConfigs: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(),
}));

import { GoogleGenAI } from '@google/genai';
import { getApiKey, getModelConfigs } from './db.js';
import { handleAnthropicProxy, handleGeminiProxy, handleOpenAIProxy } from './proxy.js';

type ProxyBody = {
  modelId: string;
  messages: { role: string; content: string }[];
};

type MockReq = {
  body: ProxyBody;
  socket: { destroyed: boolean };
  on: ReturnType<typeof vi.fn>;
};

type MockRes = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  flush: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  writableEnded: boolean;
};

const getApiKeyMock = vi.mocked(getApiKey);
const getModelConfigsMock = vi.mocked(getModelConfigs);
const GoogleGenAIMock = vi.mocked(GoogleGenAI);
const fetchMock = vi.fn();

const DEFAULT_MODEL_CONFIG = {
  id: 'model-1',
  endpoint: 'https://example.com/stream',
  modelName: 'test-model',
  name: 'Test Model',
  apiStyle: 'OPENAI' as const,
  avatarColor: '#fff',
  description: 'Test',
  isCustom: false,
};

function createMockReq(body: Partial<ProxyBody> = {}): MockReq {
  return {
    body: {
      modelId: 'model-1',
      messages: [{ role: 'user', content: 'Hello' }],
      ...body,
    },
    socket: { destroyed: false },
    on: vi.fn(),
  };
}

function createMockRes(): MockRes {
  const res: MockRes = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    flush: vi.fn(),
    on: vi.fn(),
    writableEnded: false,
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function* createAsyncIterable<T>(chunks: T[]): AsyncGenerator<T> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

function createMockReadableStream<T>(chunks: T[]) {
  const iter = createAsyncIterable(chunks);
  return {
    getReader: () => ({
      read: async () => {
        const { value, done } = await iter.next();
        return { value, done };
      }
    })
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  global.fetch = fetchMock as typeof fetch;
  getModelConfigsMock.mockReturnValue([DEFAULT_MODEL_CONFIG]);
});

describe('proxy handlers', () => {
  it('OpenAI proxy returns 400 when API key is missing', async () => {
    getApiKeyMock.mockResolvedValue(null);
    const req = createMockReq();
    const res = createMockRes();

    await handleOpenAIProxy(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'API key not configured for model' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Anthropic proxy returns 400 when API key is missing', async () => {
    getApiKeyMock.mockResolvedValue(null);
    const req = createMockReq();
    const res = createMockRes();

    await handleAnthropicProxy(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'API key not configured for model' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Gemini proxy returns 400 when API key is missing', async () => {
    getApiKeyMock.mockResolvedValue(null);
    const req = createMockReq();
    const res = createMockRes();

    await handleGeminiProxy(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'API key not configured for model' });
    expect(GoogleGenAIMock).not.toHaveBeenCalled();
  });

  it('OpenAI proxy builds correct upstream headers/body and pipes SSE verbatim', async () => {
    getApiKeyMock.mockResolvedValue('openai-key');
    getModelConfigsMock.mockReturnValue([{
      ...DEFAULT_MODEL_CONFIG,
      id: 'model-1',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      modelName: 'gpt-test',
    }]);
    fetchMock.mockResolvedValue({
      ok: true,
      body: createMockReadableStream(['data: {"x":1}\n\n', 'data: [DONE]\n\n']),
    });

    const req = createMockReq({
      messages: [{ role: 'user', content: 'Ping' }],
    });
    const res = createMockRes();

    await handleOpenAIProxy(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer openai-key',
        },
        body: JSON.stringify({
          model: 'gpt-test',
          messages: [{ role: 'user', content: 'Ping' }],
          stream: true,
        }),
      }),
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.write).toHaveBeenNthCalledWith(1, 'data: {"x":1}\n\n');
    expect(res.write).toHaveBeenNthCalledWith(2, 'data: [DONE]\n\n');
    expect(res.flush).toHaveBeenCalledTimes(2);
    expect(res.end).toHaveBeenCalledOnce();
  });

  it('OpenAI proxy keeps streaming when the request body side closes normally', async () => {
    getApiKeyMock.mockResolvedValue('openai-key');
    getModelConfigsMock.mockReturnValue([{
      ...DEFAULT_MODEL_CONFIG,
      id: 'model-1',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      modelName: 'gpt-test',
    }]);
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) {
        throw new DOMException('Request aborted before upstream fetch', 'AbortError');
      }

      return {
        ok: true,
        body: createMockReadableStream(['data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n', 'data: [DONE]\n\n']),
      };
    });

    const req = createMockReq({
      messages: [{ role: 'user', content: 'Ping' }],
    });
    req.on.mockImplementation((event: string, listener: () => void) => {
      if (event === 'close') {
        listener();
      }
      return req;
    });
    const res = createMockRes();

    await handleOpenAIProxy(req as never, res as never);

    expect(res.write).toHaveBeenNthCalledWith(1, 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n');
    expect(res.write).toHaveBeenNthCalledWith(2, 'data: [DONE]\n\n');
    expect(res.end).toHaveBeenCalledOnce();
  });

  it('Anthropic proxy builds correct upstream headers/body and extracts system message', async () => {
    getApiKeyMock.mockResolvedValue('anthropic-key');
    getModelConfigsMock.mockReturnValue([{
      ...DEFAULT_MODEL_CONFIG,
      id: 'model-1',
      endpoint: 'https://api.anthropic.com/v1/messages',
      modelName: 'claude-test',
      apiStyle: 'ANTHROPIC' as const,
    }]);
    fetchMock.mockResolvedValue({
      ok: true,
      body: createMockReadableStream(['data: {"type":"content_block_delta"}\n\n']),
    });

    const req = createMockReq({
      messages: [
        { role: 'system', content: 'Be concise' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ],
    });
    const res = createMockRes();

    await handleAnthropicProxy(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'anthropic-key',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-test',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi' },
          ],
          max_tokens: 8192,
          stream: true,
          system: 'Be concise',
        }),
      }),
    );
    expect(res.write).toHaveBeenCalledWith('data: {"type":"content_block_delta"}\n\n');
    expect(res.end).toHaveBeenCalledOnce();
  });

  it('Gemini proxy converts messages to Gemini contents format correctly', async () => {
    getApiKeyMock.mockResolvedValue('gemini-key');
    getModelConfigsMock.mockReturnValue([{
      ...DEFAULT_MODEL_CONFIG,
      id: 'model-1',
      modelName: 'gemini-2.5-flash',
      apiStyle: 'GEMINI' as const,
    }]);
    const generateContentStream = vi.fn().mockResolvedValue(createAsyncIterable([{ text: 'hello' }]));
    GoogleGenAIMock.mockImplementation(
      function mockGoogleGenAI() {
        return {
          models: { generateContentStream },
        } as never;
      },
    );

    const req = createMockReq({
      messages: [
        { role: 'system', content: 'ignored' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ],
    });
    const res = createMockRes();

    await handleGeminiProxy(req as never, res as never);

    expect(GoogleGenAIMock).toHaveBeenCalledWith({ apiKey: 'gemini-key' });
    expect(generateContentStream).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi there' }] },
      ],
      config: {
        systemInstruction: 'ignored',
        abortSignal: expect.any(AbortSignal),
      },
    });
  });

  it('Gemini proxy emits SSE text chunks and DONE marker', async () => {
    getApiKeyMock.mockResolvedValue('gemini-key');
    getModelConfigsMock.mockReturnValue([{
      ...DEFAULT_MODEL_CONFIG,
      id: 'model-1',
      modelName: 'gemini-2.5-flash',
      apiStyle: 'GEMINI' as const,
    }]);
    const generateContentStream = vi.fn().mockResolvedValue(
      createAsyncIterable([{ text: 'A' }, { text: 'B' }, { text: '' }]),
    );
    GoogleGenAIMock.mockImplementation(
      function mockGoogleGenAI() {
        return {
          models: { generateContentStream },
        } as never;
      },
    );

    const req = createMockReq();
    const res = createMockRes();

    await handleGeminiProxy(req as never, res as never);

    expect(res.write).toHaveBeenNthCalledWith(1, 'data: {"text":"A"}\n\n');
    expect(res.write).toHaveBeenNthCalledWith(2, 'data: {"text":"B"}\n\n');
    expect(res.write).toHaveBeenNthCalledWith(3, 'data: {"text":""}\n\n');
    expect(res.write).toHaveBeenNthCalledWith(4, 'data: [DONE]\n\n');
    expect(res.flush).toHaveBeenCalledTimes(3);
    expect(res.end).toHaveBeenCalledOnce();
  });

  it('OpenAI proxy aborts upstream request on client disconnect', async () => {
    getApiKeyMock.mockResolvedValue('openai-key');

    let closeHandler: (() => void) | undefined;
    fetchMock.mockImplementation(async (_input, init) => {
      closeHandler?.();
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect((init?.signal as AbortSignal).aborted).toBe(true);

      return {
        ok: true,
        body: createMockReadableStream<string>([]),
      };
    });

    const req = createMockReq();
    const res = createMockRes();
    res.on.mockImplementation((event: string, handler: () => void) => {
      if (event === 'close') {
        closeHandler = handler;
      }

      return res;
    });

    await handleOpenAIProxy(req as never, res as never);

    expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
    expect(res.end).toHaveBeenCalledOnce();
  });
});
