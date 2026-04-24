import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DbModule = typeof import('./db');

async function loadDbModule(dbPath: string, encryptionKey = 'test-encryption-key'): Promise<DbModule> {
  process.env.DB_PATH = dbPath;
  process.env.ENCRYPTION_KEY = encryptionKey;
  vi.resetModules();
  return import('./db.js');
}

describe('db', () => {
  let tempDirPath: string;
  let dbPath: string;

  beforeEach(async () => {
    tempDirPath = await mkdtemp(join(tmpdir(), 'neurosync-db-'));
    dbPath = join(tempDirPath, 'db.json');
  });

  afterEach(async () => {
    delete process.env.DB_PATH;
    delete process.env.ENCRYPTION_KEY;
    vi.resetModules();
    await rm(tempDirPath, { recursive: true, force: true });
  });

  it('encrypts API keys at rest and decrypts on read', async () => {
    const dbModule = await loadDbModule(dbPath);

    await dbModule.initDb();
    await dbModule.setApiKey('OPENAI', 'hello');

    expect(dbModule.getApiKey('OPENAI')).toBe('hello');

    const rawDb = JSON.parse(await readFile(dbPath, 'utf8')) as {
      keys: Record<string, { ciphertext: string; iv: string; tag: string; salt: string }>;
    };

    expect(rawDb.keys.OPENAI).toMatchObject({
      ciphertext: expect.any(String),
      iv: expect.any(String),
      tag: expect.any(String),
      salt: expect.any(String),
    });
    expect(rawDb.keys.OPENAI.ciphertext).not.toContain('hello');
  });

  it('initDb creates db file and seeds five default models', async () => {
    const dbModule = await loadDbModule(dbPath);

    await dbModule.initDb();

    const storedModels = dbModule.getModelConfigs();
    const rawDb = JSON.parse(await readFile(dbPath, 'utf8')) as {
      models: Array<{ id: string }>;
      keys: Record<string, unknown>;
    };

    expect(storedModels).toHaveLength(5);
    expect(storedModels.map((model) => model.id)).toEqual([
      'GEMINI',
      'OPENAI',
      'ANTHROPIC',
      'ZAI',
      'KIMI',
    ]);
    expect(rawDb.models).toHaveLength(5);
    expect(rawDb.keys).toEqual({});
  });

  it('saveModelConfig adds a new model and persists it', async () => {
    const dbModule = await loadDbModule(dbPath);

    await dbModule.initDb();
    await dbModule.saveModelConfig({
      id: 'LOCAL',
      name: 'Local Model',
      endpoint: 'http://localhost:11434/v1/chat/completions',
      modelName: 'llama3.2',
      apiStyle: 'OPENAI',
      avatarColor: '#ffaa00',
      description: 'Local inference',
      isCustom: true,
    });

    const storedModels = dbModule.getModelConfigs();
    const rawDb = JSON.parse(await readFile(dbPath, 'utf8')) as {
      models: Array<{ id: string; name: string }>;
    };

    expect(storedModels).toHaveLength(6);
    expect(storedModels.find((model) => model.id === 'LOCAL')?.name).toBe('Local Model');
    expect(rawDb.models.find((model) => model.id === 'LOCAL')?.name).toBe('Local Model');
  });

  it('saveModelConfig updates an existing model by id', async () => {
    const dbModule = await loadDbModule(dbPath);

    await dbModule.initDb();
    await dbModule.saveModelConfig({
      id: 'OPENAI',
      name: 'GPT-4.1',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      modelName: 'gpt-4.1',
      apiStyle: 'OPENAI',
      avatarColor: '#10a37f',
      description: 'Updated OpenAI model',
      isCustom: false,
    });

    const storedModels = dbModule.getModelConfigs();

    expect(storedModels).toHaveLength(5);
    expect(storedModels.find((model) => model.id === 'OPENAI')).toEqual({
      id: 'OPENAI',
      name: 'GPT-4.1',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      modelName: 'gpt-4.1',
      apiStyle: 'OPENAI',
      avatarColor: '#10a37f',
      description: 'Updated OpenAI model',
      isCustom: false,
    });
  });

  it('deleteModelConfig removes a model', async () => {
    const dbModule = await loadDbModule(dbPath);

    await dbModule.initDb();
    await dbModule.deleteModelConfig('ZAI');

    const storedModels = dbModule.getModelConfigs();

    expect(storedModels).toHaveLength(4);
    expect(storedModels.some((model) => model.id === 'ZAI')).toBe(false);
  });

  it('setApiKey and getApiKey round-trip values', async () => {
    const dbModule = await loadDbModule(dbPath);

    await dbModule.initDb();
    await dbModule.setApiKey('ANTHROPIC', 'sk-ant-secret');

    expect(dbModule.getApiKey('ANTHROPIC')).toBe('sk-ant-secret');
  });

  it('getApiKey returns null for an unknown model', async () => {
    const dbModule = await loadDbModule(dbPath);

    await dbModule.initDb();

    expect(dbModule.getApiKey('UNKNOWN')).toBeNull();
  });
});

describe('initDb – additive-only seeding', () => {
  let tempDirPath: string;
  let dbPath: string;

  beforeEach(async () => {
    tempDirPath = await mkdtemp(join(tmpdir(), 'neurosync-db-'));
    dbPath = join(tempDirPath, 'db.json');
  });

  afterEach(async () => {
    delete process.env.DB_PATH;
    delete process.env.ENCRYPTION_KEY;
    vi.resetModules();
    await rm(tempDirPath, { recursive: true, force: true });
  });

  it('does not overwrite user-edited modelName on re-init', async () => {
    // First init seeds the DB
    const dbModule = await loadDbModule(dbPath);
    await dbModule.initDb();

    // Simulate user saving a custom modelName via the Settings UI
    const models = dbModule.getModelConfigs();
    const gemini = models.find((m) => m.id === 'GEMINI');
    if (!gemini) throw new Error('GEMINI not seeded after initDb()');
    await dbModule.saveModelConfig({ ...gemini, modelName: 'user-custom-gemini-model' });

    // Re-init simulates a server restart — the custom value must survive
    await dbModule.initDb();

    const after = dbModule.getModelConfigs().find((m) => m.id === 'GEMINI');
    expect(after?.modelName).toBe('user-custom-gemini-model');
  });
});
