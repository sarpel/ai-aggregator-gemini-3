import * as http from 'node:http';
import { type Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createMockLLMServer, type MockLLMServer } from '../helpers/mockLLMServer.js';

/* ------------------------------------------------------------------ */
/* Mock @google/genai BEFORE any transitive import of proxy.ts        */
/* ------------------------------------------------------------------ */
const mockGenerateContentStream = vi.fn();

vi.mock('@google/genai', () => {
  function MockGoogleGenAI() {
    return {
      models: { generateContentStream: mockGenerateContentStream },
    };
  }
  return {
    GoogleGenAI: MockGoogleGenAI,
  };
});

/* ------------------------------------------------------------------ */
/* Mock db.js so we control getApiKey and getModelConfigs directly    */
/* ------------------------------------------------------------------ */
const apiKeys: Record<string, string> = {};
const mockModelConfigs: ReturnType<typeof import('../../db.js').getModelConfigs> = [];

vi.mock('../../db.js', () => ({
  initDb: vi.fn(),
  getModelConfigs: vi.fn(() => mockModelConfigs),
  saveModelConfig: vi.fn(),
  deleteModelConfig: vi.fn(),
  getApiKey: vi.fn((modelId: string) => apiKeys[modelId] ?? null),
  setApiKey: vi.fn((modelId: string, key: string) => {
    apiKeys[modelId] = key;
  }),
}));

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Middleware that suppresses `req.on('close', ...)` registrations so the
 * proxy's AbortController never fires during normal HTTP request/response
 * cycles in the test environment.
 *
 * Background: `express.json()` consumes the request body stream. After that,
 * the IncomingMessage readable side enters a closed state. The next tick,
 * any `close` listener registered via `req.on('close', cb)` is invoked
 * synchronously (because the event was already emitted). The proxy handler
 * registers `req.on('close', () => controller.abort())` to handle premature
 * client disconnection — but in tests this always fires immediately, aborting
 * the upstream fetch before it can return data.
 *
 * Fix: silently drop all 'close' event listeners on req. The abort-on-
 * disconnect behaviour is covered by dedicated unit tests in proxy.test.ts
 * and is not the concern of these integration tests.
 */
function suppressReqClose(
  req: http.IncomingMessage,
  _res: http.ServerResponse,
  next: () => void,
): void {
  const originalOn = req.on.bind(req);
  req.on = function patchedOn(event: string, listener: (...args: unknown[]) => void) {
    if (event === 'close') {
      // Swallow — do not register the listener at all.
      return req;
    }
    return originalOn(event, listener);
  } as typeof req.on;
  next();
}

/**
 * Use node:http directly for SSE requests to ensure the TCP connection is
 * kept open for the full response body, avoiding any premature half-close
 * from Node's fetch implementation that could interfere with streaming.
 */
function fetchSSEViaHttp(
  url: string,
  body: object,
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const postData = JSON.stringify(body);

    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parseInt(parsed.port, 10),
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString('utf8');
        });
        res.on('end', () => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === 'string') headers[k] = v;
            else if (Array.isArray(v)) headers[k] = v.join(', ');
          }
          resolve({ statusCode: res.statusCode ?? 0, headers, body: data });
        });
        res.on('error', reject);
      },
    );

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function parseSSELines(rawBody: string): string[] {
  return rawBody
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/* ------------------------------------------------------------------ */
/* Test suite                                                         */
/* ------------------------------------------------------------------ */
describe('proxy-flow integration', () => {
  let server: Server;
  let baseUrl: string;
  let mockLLM: MockLLMServer;

  beforeAll(async () => {
    // Start mock LLM server
    mockLLM = createMockLLMServer();
    await mockLLM.start();

    // Set API keys in our mock store
    apiKeys['OPENAI'] = 'test-openai-key';
    apiKeys['ANTHROPIC'] = 'test-anthropic-key';
    apiKeys['GEMINI'] = 'test-gemini-key';

    // Populate model configs with mock LLM server URL (set after server starts)
    mockModelConfigs.push(
      {
        id: 'OPENAI',
        name: 'OpenAI GPT',
        endpoint: `${mockLLM.url}/v1/chat/completions`,
        modelName: 'gpt-test',
        apiStyle: 'OPENAI',
        avatarColor: '#74b9ff',
        description: 'Test OpenAI model',
        isCustom: false,
      },
      {
        id: 'ANTHROPIC',
        name: 'Anthropic Claude',
        endpoint: `${mockLLM.url}/v1/messages`,
        modelName: 'claude-test',
        apiStyle: 'ANTHROPIC',
        avatarColor: '#a29bfe',
        description: 'Test Anthropic model',
        isCustom: false,
      },
      {
        id: 'GEMINI',
        name: 'Gemini',
        endpoint: '',
        modelName: 'gemini-2.5-flash',
        apiStyle: 'GEMINI',
        avatarColor: '#55efc4',
        description: 'Test Gemini model',
        isCustom: false,
      },
    );

    // Import proxy handlers (will use our mocked db.js and @google/genai)
    const { handleOpenAIProxy, handleAnthropicProxy, handleGeminiProxy } =
      await import('../../proxy.js');

    // Build Express app — suppressReqClose must come BEFORE proxy handlers
    const app = express();
    app.use(express.json());
    app.use(suppressReqClose);
    app.post('/api/proxy/openai', handleOpenAIProxy);
    app.post('/api/proxy/anthropic', handleAnthropicProxy);
    app.post('/api/proxy/gemini', handleGeminiProxy);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address();
    if (addr && typeof addr === 'object') {
      baseUrl = `http://127.0.0.1:${addr.port}`;
    }
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server?.close((err) => (err ? reject(err) : resolve()));
    });
    await mockLLM?.stop();
  });

  describe('OpenAI proxy', () => {
    it('streams SSE response from mock LLM server', async () => {
      const result = await fetchSSEViaHttp(`${baseUrl}/api/proxy/openai`, {
        modelId: 'OPENAI',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.statusCode).toBe(200);
      expect(result.headers['content-type']).toContain('text/event-stream');

      const chunks = parseSSELines(result.body);
      expect(chunks).toContain('data: {"choices":[{"delta":{"content":"Hello"}}]}');
      expect(chunks).toContain('data: {"choices":[{"delta":{"content":" world"}}]}');
      expect(chunks).toContain('data: [DONE]');
    });

    it('returns 400 when API key is not configured', async () => {
      const res = await fetch(`${baseUrl}/api/proxy/openai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'NO_KEY_MODEL',
          endpoint: `${mockLLM.url}/v1/chat/completions`,
          modelName: 'test',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('API key not configured');
    });

    it('propagates upstream errors', async () => {
      mockLLM.nextErrorStatus = 500;

      const result = await fetchSSEViaHttp(`${baseUrl}/api/proxy/openai`, {
        modelId: 'OPENAI',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.statusCode).toBe(200); // SSE endpoint returns 200, error in stream
      const chunks = parseSSELines(result.body);
      const errorChunk = chunks.find((c) => c.includes('error'));
      expect(errorChunk).toBeTruthy();
    });
  });

  describe('Anthropic proxy', () => {
    it('streams SSE response from mock LLM server', async () => {
      const result = await fetchSSEViaHttp(`${baseUrl}/api/proxy/anthropic`, {
        modelId: 'ANTHROPIC',
        messages: [
          { role: 'system', content: 'Be helpful' },
          { role: 'user', content: 'Hello' },
        ],
      });

      expect(result.statusCode).toBe(200);
      expect(result.headers['content-type']).toContain('text/event-stream');

      const chunks = parseSSELines(result.body);
      expect(chunks.some((c) => c.includes('content_block_delta'))).toBe(true);
    });

    it('returns 400 when API key is not configured', async () => {
      const res = await fetch(`${baseUrl}/api/proxy/anthropic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'NO_KEY_MODEL',
          endpoint: `${mockLLM.url}/v1/messages`,
          modelName: 'test',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('API key not configured');
    });

    it('propagates upstream errors', async () => {
      mockLLM.nextErrorStatus = 502;

      const result = await fetchSSEViaHttp(`${baseUrl}/api/proxy/anthropic`, {
        modelId: 'ANTHROPIC',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.statusCode).toBe(200);
      const chunks = parseSSELines(result.body);
      const errorChunk = chunks.find((c) => c.includes('error'));
      expect(errorChunk).toBeTruthy();
    });
  });

  describe('Gemini proxy', () => {
    it(
      'streams SSE response via mocked SDK',
      async () => {
        const iterable = (async function* () {
          yield { text: 'Hello' };
          yield { text: ' world' };
        })();

        mockGenerateContentStream.mockResolvedValueOnce(iterable);

        const result = await fetchSSEViaHttp(`${baseUrl}/api/proxy/gemini`, {
          modelId: 'GEMINI',
          messages: [{ role: 'user', content: 'Hello' }],
        });

        expect(result.statusCode).toBe(200);
        expect(result.headers['content-type']).toContain('text/event-stream');

        const lines = parseSSELines(result.body);
        expect(lines.some((c) => c.includes('"text":"Hello"'))).toBe(true);
        expect(lines.some((c) => c.includes('"text":" world"'))).toBe(true);
        expect(lines.some((c) => c.includes('[DONE]'))).toBe(true);
      },
      15000,
    );

    it('returns 400 when API key is not configured', async () => {
      const res = await fetch(`${baseUrl}/api/proxy/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'NO_KEY_MODEL',
          modelName: 'gemini-test',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('API key not configured');
    });
  });
});
