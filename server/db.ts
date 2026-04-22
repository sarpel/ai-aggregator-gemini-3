import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

export interface EncryptedKey {
  ciphertext: string;
  iv: string;
  tag: string;
  salt: string;
}

export interface ModelConfigStored {
  id: string;
  name: string;
  endpoint: string;
  modelName: string;
  apiStyle: 'OPENAI' | 'ANTHROPIC' | 'GEMINI';
  avatarColor: string;
  description: string;
  isCustom: boolean;
}

interface DbSchema {
  models: ModelConfigStored[];
  keys: Record<string, EncryptedKey>;
}

const DEFAULT_MODELS: ModelConfigStored[] = [
  { id: 'GEMINI', name: 'Gemini 3.1 Pro', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:streamGenerateContent', modelName: 'gemini-3.1-pro-preview', apiStyle: 'GEMINI', avatarColor: '#00f3ff', description: 'Google Gemini 3.1 Pro Preview', isCustom: false },
  { id: 'OPENAI', name: 'GPT-5.4', endpoint: 'https://api.openai.com/v1/chat/completions', modelName: 'gpt-5.4', apiStyle: 'OPENAI', avatarColor: '#10a37f', description: 'OpenAI GPT-5.4', isCustom: false },
  { id: 'ANTHROPIC', name: 'Claude Sonnet 4.6', endpoint: 'https://api.anthropic.com/v1/messages', modelName: 'claude-sonnet-4.6', apiStyle: 'ANTHROPIC', avatarColor: '#d97757', description: 'Anthropic Sonnet 4.6', isCustom: false },
  { id: 'ZAI', name: 'glm-5.1', endpoint: 'https://api.z.ai/api/coding/paas/v4', modelName: 'glm-5.1', apiStyle: 'OPENAI', avatarColor: '#fff', description: 'Z.AI GLM 5.1', isCustom: true },
  { id: 'KIMI', name: 'Kimi K2.5', endpoint: 'https://api.kimi.com/coding/v1', modelName: 'kimi-for-coding', apiStyle: 'OPENAI', avatarColor: '#4e61e6', description: 'Kimi K2.5', isCustom: true },
];

let db: Low<DbSchema>;

function getDbPath(): string {
  return process.env.DB_PATH ?? 'db.json';
}

function getMasterKey(): string {
  const masterKey = process.env.ENCRYPTION_KEY;

  if (masterKey) {
    return masterKey;
  }

  throw new Error('ENCRYPTION_KEY environment variable is required. Set it before starting the server.');
}

function ensureDb(): Low<DbSchema> {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }

  return db;
}

function cloneModelConfig(config: ModelConfigStored): ModelConfigStored {
  return { ...config };
}

async function persistDb(database: Low<DbSchema>): Promise<void> {
  await database.write();
}

function encrypt(plaintext: string): EncryptedKey {
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const derivedKey = scryptSync(getMasterKey(), salt, 32);
  const cipher = createCipheriv('aes-256-gcm', derivedKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    salt: salt.toString('hex'),
  };
}

function decrypt(enc: EncryptedKey): string {
  const derivedKey = scryptSync(getMasterKey(), Buffer.from(enc.salt, 'hex'), 32);
  const decipher = createDecipheriv('aes-256-gcm', derivedKey, Buffer.from(enc.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'hex'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, 'hex')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

export async function initDb(): Promise<void> {
  const dbPath = getDbPath();
  await mkdir(dirname(dbPath), { recursive: true });
  const adapter = new JSONFile<DbSchema>(dbPath);
  db = new Low<DbSchema>(adapter, { models: [], keys: {} });
  await db.read();

  if (db.data.models.length === 0) {
    db.data.models = DEFAULT_MODELS.map(cloneModelConfig);
    await persistDb(db);
  }
}

export function getModelConfigs(): ModelConfigStored[] {
  return ensureDb().data.models.map(cloneModelConfig);
}

export async function saveModelConfig(config: ModelConfigStored): Promise<void> {
  const database = ensureDb();
  const existingIndex = database.data.models.findIndex((model) => model.id === config.id);
  const nextConfig = cloneModelConfig(config);

  if (existingIndex >= 0) {
    database.data.models[existingIndex] = nextConfig;
  } else {
    database.data.models.push(nextConfig);
  }

  await persistDb(database);
}

export async function deleteModelConfig(id: string): Promise<void> {
  const database = ensureDb();
  database.data.models = database.data.models.filter((model) => model.id !== id);
  delete database.data.keys[id];
  await persistDb(database);
}

export function getApiKey(modelId: string): string | null {
  const encryptedKey = ensureDb().data.keys[modelId];
  return encryptedKey ? decrypt(encryptedKey) : null;
}

export async function setApiKey(modelId: string, key: string): Promise<void> {
  const database = ensureDb();
  database.data.keys[modelId] = encrypt(key);
  await persistDb(database);
}
