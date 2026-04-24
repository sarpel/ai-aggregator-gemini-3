import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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
  { id: 'ZAI', name: 'glm-5.1', endpoint: 'https://api.z.ai/api/coding/paas/v4/chat/completions', modelName: 'glm-5.1', apiStyle: 'OPENAI', avatarColor: '#fff', description: 'Z.AI GLM 5.1', isCustom: true },
  { id: 'KIMI', name: 'Kimi K2.5', endpoint: 'https://api.kimi.com/coding/v1/chat/completions', modelName: 'kimi-for-coding', apiStyle: 'OPENAI', avatarColor: '#4e61e6', description: 'Kimi K2.5', isCustom: true },
  { id: 'MINIMAX', name: 'Minimax-2.7', endpoint: 'https://api.minimax.io/v1/chat/completions', modelName: 'Minimax-2.7', apiStyle: 'OPENAI', avatarColor: '#ff6b35', description: 'Minimax 2.7', isCustom: false },
  { id: 'QWEN', name: 'Qwen-3.6 Plus', endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', modelName: 'Qwen-3.6 Plus', apiStyle: 'OPENAI', avatarColor: '#6e40c9', description: 'Alibaba Qwen 3.6 Plus', isCustom: false },
  { id: 'XAI', name: 'Grok-4.20', endpoint: 'https://api.x.ai/v1/chat/completions', modelName: 'grok-4.20-reasoning-latest', apiStyle: 'OPENAI', avatarColor: '#e8e8e8', description: 'xAI Grok 4.20 Reasoning', isCustom: false },
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

async function ensureEncryptionKey(): Promise<string> {
  const existing = process.env.ENCRYPTION_KEY;
  if (existing) return existing;

  const dbDir = dirname(getDbPath());
  const envPath = join(dbDir, '.env');

  // Try reading existing .env
  try {
    const envContent = await readFile(envPath, 'utf8');
    const match = envContent.match(/^ENCRYPTION_KEY\s*=\s*['"]?([^'"\n\r]+)['"]?\s*$/m);
    if (match?.[1]) {
      process.env.ENCRYPTION_KEY = match[1];
      return match[1];
    }
  } catch {
    // .env doesn't exist yet, will create below
  }

  // Generate and persist a new key
  const newKey = randomBytes(32).toString('hex');
  const line = `ENCRYPTION_KEY=${newKey}\n`;
  try {
    let envContent = '';
    try {
      envContent = await readFile(envPath, 'utf8');
      // Remove any existing empty/placeholder ENCRYPTION_KEY line
      envContent = envContent.replace(/^ENCRYPTION_KEY\s*=\s*.*$/m, '').trim();
      if (envContent) envContent += '\n';
    } catch {
      // no existing file
    }
    await writeFile(envPath, envContent + line, 'utf8');
  } catch {
    // Can't persist — that's OK, key works for this session
  }

  process.env.ENCRYPTION_KEY = newKey;
  return newKey;
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
  } else {
    // Add any default models not yet in the DB (additive only — never overwrite user changes)
    const existingIds = new Set(db.data.models.map((m) => m.id));
    let needsPersist = false;
    for (const def of DEFAULT_MODELS) {
      if (!existingIds.has(def.id)) {
        db.data.models.push(cloneModelConfig(def));
        needsPersist = true;
      }
    }
    if (needsPersist) {
      await persistDb(db);
    }
  }

  await ensureEncryptionKey();
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
