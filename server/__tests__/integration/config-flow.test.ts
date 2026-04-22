import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import cors from 'cors';
import express from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type DbModule = typeof import('../../db');
type RoutesModule = typeof import('../../routes');

describe('config-flow integration', () => {
  let tempDir: string;
  let dbPath: string;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'neurosync-config-'));
    dbPath = join(tempDir, 'db.json');

    process.env.DB_PATH = dbPath;
    process.env.ENCRYPTION_KEY = 'integration-test-key-32chars!!';

    vi.resetModules();

    const dbModule: DbModule = await import('../../db.js');
    await dbModule.initDb();

    const routesModule: RoutesModule = await import('../../routes.js');
    const router = routesModule.default;

    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api', router);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address();
    if (addr === null) {
      throw new Error('Server not listening — server.address() returned null');
    }
    if (typeof addr === 'string') {
      throw new Error(`Unix socket address not supported in tests: ${addr}`);
    }
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    delete process.env.DB_PATH;
    delete process.env.ENCRYPTION_KEY;
    vi.resetModules();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('GET /api/models returns seeded default models', async () => {
    const res = await fetch(`${baseUrl}/api/models`);
    expect(res.status).toBe(200);

    const models = (await res.json()) as Array<{ id: string; isCustom: boolean }>;
    expect(models.length).toBeGreaterThanOrEqual(5);

    const ids = models.map((m) => m.id);
    expect(ids).toContain('GEMINI');
    expect(ids).toContain('OPENAI');
    expect(ids).toContain('ANTHROPIC');
  });

  it('POST /api/models creates a new custom model', async () => {
    const res = await fetch(`${baseUrl}/api/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Integration Test Model',
        endpoint: 'https://example.com/v1/chat/completions',
        modelName: 'test-model',
        apiStyle: 'OPENAI',
        avatarColor: '#ff0000',
        description: 'Created in integration test',
        apiKey: 'test-api-key-123',
      }),
    });

    expect(res.status).toBe(201);

    const body = (await res.json()) as { id: string; name: string; isCustom: boolean };
    expect(body.name).toBe('Integration Test Model');
    expect(body.isCustom).toBe(true);
    expect(body.id).toBeTruthy();

    // Verify it appears in GET
    const listRes = await fetch(`${baseUrl}/api/models`);
    const models = (await listRes.json()) as Array<{ id: string; name: string }>;
    expect(models.some((m) => m.id === body.id)).toBe(true);
  });

  it('POST /api/models returns 400 for missing required fields', async () => {
    const res = await fetch(`${baseUrl}/api/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: 'https://example.com' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('name');
  });

  it('PUT /api/models/:id updates an existing model', async () => {
    // First create a model
    const createRes = await fetch(`${baseUrl}/api/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Update Target',
        endpoint: 'https://example.com/v1/chat/completions',
        modelName: 'update-me',
        apiStyle: 'OPENAI',
      }),
    });
    const created = (await createRes.json()) as { id: string };

    // Update it
    const updateRes = await fetch(`${baseUrl}/api/models/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Updated Name',
        description: 'Updated description',
      }),
    });

    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as { id: string; name: string; description: string };
    expect(updated.name).toBe('Updated Name');
    expect(updated.description).toBe('Updated description');

    // Verify persistence via GET
    const listRes = await fetch(`${baseUrl}/api/models`);
    const models = (await listRes.json()) as Array<{ id: string; name: string }>;
    const found = models.find((m) => m.id === created.id);
    expect(found?.name).toBe('Updated Name');
  });

  it('PUT /api/models/:id returns 404 for non-existent model', async () => {
    const res = await fetch(`${baseUrl}/api/models/non-existent-id`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Does not matter' }),
    });

    expect(res.status).toBe(404);
  });

  it('DELETE /api/models/:id removes a custom model', async () => {
    // Create a model to delete
    const createRes = await fetch(`${baseUrl}/api/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Delete Target',
        endpoint: 'https://example.com/v1/chat/completions',
        modelName: 'delete-me',
        apiStyle: 'OPENAI',
      }),
    });
    const created = (await createRes.json()) as { id: string };

    // Delete it
    const deleteRes = await fetch(`${baseUrl}/api/models/${created.id}`, {
      method: 'DELETE',
    });
    expect(deleteRes.status).toBe(204);

    // Verify it's gone
    const listRes = await fetch(`${baseUrl}/api/models`);
    const models = (await listRes.json()) as Array<{ id: string }>;
    expect(models.some((m) => m.id === created.id)).toBe(false);
  });

  it('DELETE /api/models/:id returns 403 for default models', async () => {
    const res = await fetch(`${baseUrl}/api/models/OPENAI`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Cannot delete default models');
  });

  it('POST /api/models/:id/key stores and verifies API key', async () => {
    // Store key
    const keyRes = await fetch(`${baseUrl}/api/models/OPENAI/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'sk-integration-test' }),
    });

    expect(keyRes.status).toBe(200);
    const keyBody = (await keyRes.json()) as { success: boolean };
    expect(keyBody.success).toBe(true);

    // Check key status
    const statusRes = await fetch(`${baseUrl}/api/models/OPENAI/key/status`);
    expect(statusRes.status).toBe(200);
    const statusBody = (await statusRes.json()) as { hasKey: boolean };
    expect(statusBody.hasKey).toBe(true);
  });

  it('GET /api/models/:id/key/status returns false for model without key', async () => {
    // Create a fresh model
    const createRes = await fetch(`${baseUrl}/api/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'No Key Model',
        endpoint: 'https://example.com/v1/chat/completions',
        modelName: 'no-key',
        apiStyle: 'OPENAI',
      }),
    });
    const created = (await createRes.json()) as { id: string };

    const statusRes = await fetch(`${baseUrl}/api/models/${created.id}/key/status`);
    expect(statusRes.status).toBe(200);
    const statusBody = (await statusRes.json()) as { hasKey: boolean };
    expect(statusBody.hasKey).toBe(false);
  });

  it('DB encryption round-trips API keys correctly', async () => {
    // This tests that the integration between routes and DB encryption works
    const dbModule: DbModule = await import('../../db.js');

    // Set key via API
    await fetch(`${baseUrl}/api/models/ANTHROPIC/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'sk-ant-encrypted-roundtrip' }),
    });

    // Read key directly from DB module
    const key = dbModule.getApiKey('ANTHROPIC');
    expect(key).toBe('sk-ant-encrypted-roundtrip');
  });
});
