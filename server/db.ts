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
  { id: 'GEMINI', name: 'Gemini 2.5 Flash', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent', modelName: 'gemini-2.5-flash', apiStyle: 'GEMINI', avatarColor: '#00f3ff', description: 'Google Multimodal Fast', isCustom: false },
  { id: 'OPENAI', name: 'GPT-4o', endpoint: 'https://api.openai.com/v1/chat/completions', modelName: 'gpt-4o', apiStyle: 'OPENAI', avatarColor: '#10a37f', description: 'OpenAI Omni', isCustom: false },
  { id: 'ANTHROPIC', name: 'Claude 3.5 Sonnet', endpoint: 'https://api.anthropic.com/v1/messages', modelName: 'claude-3-5-sonnet-20241022', apiStyle: 'ANTHROPIC', avatarColor: '#d97757', description: 'Anthropic New Sonnet', isCustom: false },
  { id: 'GROK', name: 'Grok 2', endpoint: 'https://api.x.ai/v1/chat/completions', modelName: 'grok-2-latest', apiStyle: 'OPENAI', avatarColor: '#fff', description: 'xAI Grok 2', isCustom: false },
  { id: 'DEEPSEEK', name: 'DeepSeek V3', endpoint: 'https://api.deepseek.com/chat/completions', modelName: 'deepseek-chat', apiStyle: 'OPENAI', avatarColor: '#4e61e6', description: 'DeepSeek Chat V3', isCustom: false },
];

let db: Low<DbSchema>;
let hasWarnedAboutFallbackKey = false;

function getDbPath(): string {
  return process.env.DB_PATH ?? 'db.json';
}

function getMasterKey(): string {
  const masterKey = process.env.ENCRYPTION_KEY;

  if (masterKey) {
    return masterKey;
  }

  if (!hasWarnedAboutFallbackKey) {
    console.warn('[db] ENCRYPTION_KEY not set — using dev fallback. DO NOT use in production.');
    hasWarnedAboutFallbackKey = true;
  }

  return 'dev-fallback-key-change-in-prod';
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
