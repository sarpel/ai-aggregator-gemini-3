import * as http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import cors from 'cors';
import express from 'express';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createMockLLMServer, type MockLLMServer } from '../helpers/mockLLMServer.js';

/* ------------------------------------------------------------------ */
/* Gemini SDK mock — must be declared before any import of proxy.ts    */
/* ------------------------------------------------------------------ */
const mockGenerateContentStream = vi.fn();

vi.mock('@google/genai', () => {
  function MockGoogleGenAI() {
    return {
      models: { generateContentStream: mockGenerateContentStream },
    };
  }
  return { GoogleGenAI: MockGoogleGenAI };
});

/* ------------------------------------------------------------------ */
/* Suppress req.on('close') in test env — same pattern as proxy-flow  */
/* ------------------------------------------------------------------ */
function suppressReqClose(
  req: http.IncomingMessage,
  _res: http.ServerResponse,
  next: () => void,
): void {
  const originalOn = req.on.bind(req);
  req.on = function patchedOn(event: string, listener: (...args: unknown[]) => void) {
    if (event === 'close') return req;
    return originalOn(event, listener);
  } as typeof req.on;
  next();
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type DbModule = typeof import('../../db');

function httpPost(
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

async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T;
  return { status: res.status, data };
}

function parseSSELines(rawBody: string): string[] {
  return rawBody
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/* ------------------------------------------------------------------ */
/* E2E test suite                                                      */
/* ------------------------------------------------------------------ */
describe('e2e-flow integration', () => {
  let tempDir: string;
  let server: Server;
  let baseUrl: string;
  let mockLLM: MockLLMServer;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'neurosync-e2e-'));
    const dbPath = join(tempDir, 'db.json');

    process.env.DB_PATH = dbPath;
    process.env.ENCRYPTION_KEY = 'e2e-test-key-must-be-32-chars!!';

    vi.resetModules();

    // Init DB
    const dbModule: DbModule = await import('../../db.js');
    await dbModule.initDb();

    // Import routes and proxy handlers
    const routesModule = await import('../../routes.js');
    const { handleOpenAIProxy, handleAnthropicProxy, handleGeminiProxy } =
      await import('../../proxy.js');

    // Start mock LLM server
    mockLLM = createMockLLMServer();
    await mockLLM.start();

    // Build Express app
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use(suppressReqClose);
    app.use('/api', routesModule.default as unknown as express.Router);
    app.post('/api/proxy/openai', handleOpenAIProxy);
    app.post('/api/proxy/anthropic', handleAnthropicProxy);
    app.post('/api/proxy/gemini', handleGeminiProxy);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error(`server.address() returned unexpected value: ${String(addr)}`);
    }
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server?.close((err) => (err ? reject(err) : resolve()));
    });
    await mockLLM?.stop();
    delete process.env.DB_PATH;
    delete process.env.ENCRYPTION_KEY;
    vi.resetModules();
    await rm(tempDir, { recursive: true, force: true });
  });

  afterEach(() => {
    mockGenerateContentStream.mockReset();
  });

  it('full pipeline: create models, set keys, verify status, stream all providers', async () => {
    // ── Step 1: Create custom models for each provider ──
    const openaiModel = await fetchJson<{ id: string; name: string; isCustom: boolean }>(
      `${baseUrl}/api/models`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'E2E OpenAI',
          endpoint: `${mockLLM.url}/v1/chat/completions`,
          modelName: 'gpt-e2e',
          apiStyle: 'OPENAI',
          avatarColor: '#00ff00',
          description: 'E2E test OpenAI model',
        }),
      },
    );
    expect(openaiModel.status).toBe(201);
    expect(openaiModel.data.isCustom).toBe(true);

    const anthropicModel = await fetchJson<{ id: string; name: string }>(
      `${baseUrl}/api/models`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'E2E Anthropic',
          endpoint: `${mockLLM.url}/v1/messages`,
          modelName: 'claude-e2e',
          apiStyle: 'ANTHROPIC',
          avatarColor: '#ff00ff',
          description: 'E2E test Anthropic model',
        }),
      },
    );
    expect(anthropicModel.status).toBe(201);

    const geminiModel = await fetchJson<{ id: string; name: string }>(
      `${baseUrl}/api/models`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'E2E Gemini',
          endpoint: '',
          modelName: 'gemini-e2e',
          apiStyle: 'GEMINI',
          avatarColor: '#0000ff',
          description: 'E2E test Gemini model',
        }),
      },
    );
    expect(geminiModel.status).toBe(201);

    // ── Step 2: Verify models appear in GET /api/models ──
    const listResult = await fetchJson<Array<{ id: string; name: string }>>(
      `${baseUrl}/api/models`,
    );
    expect(listResult.status).toBe(200);
    const modelIds = listResult.data.map((m) => m.id);
    expect(modelIds).toContain(openaiModel.data.id);
    expect(modelIds).toContain(anthropicModel.data.id);
    expect(modelIds).toContain(geminiModel.data.id);

    // ── Step 3: Set API keys for all 3 models ──
    for (const modelId of [openaiModel.data.id, anthropicModel.data.id, geminiModel.data.id]) {
      const keyResult = await fetchJson<{ success: boolean }>(
        `${baseUrl}/api/models/${modelId}/key`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: `e2e-key-${modelId}` }),
        },
      );
      expect(keyResult.status).toBe(200);
      expect(keyResult.data.success).toBe(true);
    }

    // ── Step 4: Verify key status for all 3 ──
    for (const modelId of [openaiModel.data.id, anthropicModel.data.id, geminiModel.data.id]) {
      const statusResult = await fetchJson<{ hasKey: boolean }>(
        `${baseUrl}/api/models/${modelId}/key/status`,
      );
      expect(statusResult.status).toBe(200);
      expect(statusResult.data.hasKey).toBe(true);
    }

    // ── Step 5: Stream via OpenAI proxy ──
    const openaiStream = await httpPost(`${baseUrl}/api/proxy/openai`, {
      modelId: openaiModel.data.id,
      endpoint: `${mockLLM.url}/v1/chat/completions`,
      modelName: 'gpt-e2e',
      messages: [{ role: 'user', content: 'E2E test' }],
    });
    expect(openaiStream.statusCode).toBe(200);
    expect(openaiStream.headers['content-type']).toContain('text/event-stream');
    const openaiLines = parseSSELines(openaiStream.body);
    expect(openaiLines).toContain('data: {"choices":[{"delta":{"content":"Hello"}}]}');
    expect(openaiLines).toContain('data: [DONE]');

    // ── Step 6: Stream via Anthropic proxy ──
    const anthropicStream = await httpPost(`${baseUrl}/api/proxy/anthropic`, {
      modelId: anthropicModel.data.id,
      endpoint: `${mockLLM.url}/v1/messages`,
      modelName: 'claude-e2e',
      messages: [{ role: 'user', content: 'E2E test' }],
    });
    expect(anthropicStream.statusCode).toBe(200);
    expect(anthropicStream.headers['content-type']).toContain('text/event-stream');
    const anthropicLines = parseSSELines(anthropicStream.body);
    expect(anthropicLines.some((c) => c.includes('content_block_delta'))).toBe(true);

    // ── Step 7: Stream via Gemini proxy (mocked SDK) ──
    const geminiIterable = (async function* () {
      yield { text: 'E2E' };
      yield { text: ' Gemini' };
    })();
    mockGenerateContentStream.mockResolvedValueOnce(geminiIterable);

    const geminiStream = await httpPost(`${baseUrl}/api/proxy/gemini`, {
      modelId: geminiModel.data.id,
      modelName: 'gemini-e2e',
      messages: [{ role: 'user', content: 'E2E test' }],
    });
    expect(geminiStream.statusCode).toBe(200);
    const geminiLines = parseSSELines(geminiStream.body);
    expect(geminiLines.some((c) => c.includes('"text":"E2E"'))).toBe(true);
    expect(geminiLines.some((c) => c.includes('"text":" Gemini"'))).toBe(true);
    expect(geminiLines.some((c) => c.includes('[DONE]'))).toBe(true);
  });

  it('model update pipeline: create model, update endpoint, stream uses new config', async () => {
    // Create model pointing to a placeholder endpoint
    const createResult = await fetchJson<{ id: string; endpoint: string }>(
      `${baseUrl}/api/models`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'E2E Update Target',
          endpoint: 'https://placeholder.example.com/v1/chat/completions',
          modelName: 'gpt-update',
          apiStyle: 'OPENAI',
        }),
      },
    );
    expect(createResult.status).toBe(201);
    const modelId = createResult.data.id;

    // Set API key
    const keyResult = await fetchJson<{ success: boolean }>(
      `${baseUrl}/api/models/${modelId}/key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'e2e-update-key' }),
      },
    );
    expect(keyResult.status).toBe(200);
    expect(keyResult.data.success).toBe(true);

    // Update endpoint to point to mock LLM
    const updateResult = await fetchJson<{ id: string; endpoint: string }>(
      `${baseUrl}/api/models/${modelId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: `${mockLLM.url}/v1/chat/completions`,
        }),
      },
    );
    expect(updateResult.status).toBe(200);
    expect(updateResult.data.endpoint).toBe(`${mockLLM.url}/v1/chat/completions`);

    // Stream — should now use the updated endpoint and get mock data back
    const stream = await httpPost(`${baseUrl}/api/proxy/openai`, {
      modelId,
      endpoint: updateResult.data.endpoint,
      modelName: 'gpt-update',
      messages: [{ role: 'user', content: 'test update' }],
    });
    expect(stream.statusCode).toBe(200);
    const lines = parseSSELines(stream.body);
    expect(lines).toContain('data: {"choices":[{"delta":{"content":"Hello"}}]}');
    expect(lines).toContain('data: [DONE]');
  });

  it('model deletion pipeline: create, stream, delete, verify gone', async () => {
    // Create model
    const createResult = await fetchJson<{ id: string }>(
      `${baseUrl}/api/models`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'E2E Delete Target',
          endpoint: `${mockLLM.url}/v1/chat/completions`,
          modelName: 'gpt-delete',
          apiStyle: 'OPENAI',
          apiKey: 'e2e-delete-key',
        }),
      },
    );
    expect(createResult.status).toBe(201);
    const modelId = createResult.data.id;

    // Stream works before deletion
    const stream = await httpPost(`${baseUrl}/api/proxy/openai`, {
      modelId,
      endpoint: `${mockLLM.url}/v1/chat/completions`,
      modelName: 'gpt-delete',
      messages: [{ role: 'user', content: 'pre-delete' }],
    });
    expect(stream.statusCode).toBe(200);
    expect(parseSSELines(stream.body)).toContain('data: [DONE]');

    // Delete the model
    const deleteResult = await fetch(`${baseUrl}/api/models/${modelId}`, {
      method: 'DELETE',
    });
    expect(deleteResult.status).toBe(204);

    // Verify it's gone from listing
    const listResult = await fetchJson<Array<{ id: string }>>(
      `${baseUrl}/api/models`,
    );
    expect(listResult.data.some((m) => m.id === modelId)).toBe(false);
  });
});
