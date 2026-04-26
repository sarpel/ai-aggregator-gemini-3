import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
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
  { id: 'MINIMAX', name: 'Minimax-2.7', endpoint: 'https://api.minimax.io/v1/chat/completions', modelName: 'Minimax-2.7', apiStyle: 'OPENAI', avatarColor: '#ff6b35', description: 'Minimax 2.7', isCustom: false },
  { id: 'QWEN', name: 'Qwen-3.6 Plus', endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', modelName: 'Qwen-3.6 Plus', apiStyle: 'OPENAI', avatarColor: '#6e40c9', description: 'Alibaba Qwen 3.6 Plus', isCustom: false },
  { id: 'XAI', name: 'Grok-4.20', endpoint: 'https://api.x.ai/v1/chat/completions', modelName: 'grok-4.20-reasoning-latest', apiStyle: 'OPENAI', avatarColor: '#e8e8e8', description: 'xAI Grok 4.20 Reasoning', isCustom: false },
];

let db: Low<DbSchema>;

function deriveKey(salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(getMasterKey(), salt, 32, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

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

async function ensureEncryptionKey(hasExistingEncryptedData: boolean): Promise<string> {
  const existing = process.env.ENCRYPTION_KEY;
  if (existing) return existing;

  const dbDir = dirname(getDbPath());
  const envPath = join(dbDir, '.env');
  const lockPath = envPath + '.lock';

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

  // If there are existing encrypted keys in the DB but no encryption key available,
  // generating a new key would make those keys undecryptable — fail loudly instead.
  if (hasExistingEncryptedData) {
    throw new Error(
      'ENCRYPTION_KEY is not set, but the database contains encrypted API keys. ' +
      'Set the ENCRYPTION_KEY environment variable to the original key used to encrypt these values. ' +
      'Generating a new key would make existing encrypted data unrecoverable.',
    );
  }

  // Gate automatic key generation behind an explicit opt-in flag
  if (!process.env.ALLOW_AUTO_KEY_GEN) {
    throw new Error(
      'ENCRYPTION_KEY is not set and no existing key was found. ' +
      'Set ALLOW_AUTO_KEY_GEN=1 to allow automatic key generation, or set ENCRYPTION_KEY explicitly.',
    );
  }

  // Acquire lock with retries
  let lockFd: import('node:fs').promises.FileHandle | null = null;
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const fs = await import('node:fs/promises');
      lockFd = await fs.open(lockPath, 'wx');
      break;
    } catch {
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 100));
      } else {
        throw new Error(
          `Failed to acquire lock file ${lockPath} after ${maxRetries} attempts. ` +
            'Another process may be generating the encryption key.',
        );
      }
    }
  }

  try {
    // Re-read .env after acquiring lock (another process may have written it)
    try {
      const envContent = await readFile(envPath, 'utf8');
      const match = envContent.match(/^ENCRYPTION_KEY\s*=\s*['"]?([^'"\n\r]+)['"]?\s*$/m);
      if (match?.[1]) {
        process.env.ENCRYPTION_KEY = match[1];
        return match[1];
      }
    } catch {
      // still doesn't exist
    }

    // Generate and persist a new key via temp file for atomic replace
    const newKey = randomBytes(32).toString('hex');
    console.warn(
      `[ensureEncryptionKey] Auto-generating new encryption key (ALLOW_AUTO_KEY_GEN=1). ` +
      `Key will be persisted to ${envPath}. ` +
      `Key fingerprint: ${newKey.slice(0, 4)}...${newKey.slice(-4)}`,
    );
    const line = `ENCRYPTION_KEY=${newKey}\n`;
    const tmpPath = envPath + '.tmp';

    try {
      let envContent = '';
      try {
        envContent = await readFile(envPath, 'utf8');
        envContent = envContent.replace(/^ENCRYPTION_KEY\s*=\s*.*$/m, '').trim();
        if (envContent) envContent += '\n';
      } catch {
        // no existing file
      }

      const fs = await import('node:fs/promises');
      await fs.writeFile(tmpPath, envContent + line, 'utf8');
      await fs.rename(tmpPath, envPath);
    } catch (writeError) {
      const message = `Failed to persist ENCRYPTION_KEY to ${envPath}. ` +
        'Set ENCRYPTION_KEY explicitly before starting the server.';
      console.error(
        `[ensureEncryptionKey] ${message}`,
        writeError instanceof Error ? writeError.message : String(writeError),
      );
      throw new Error(message);
    }

    process.env.ENCRYPTION_KEY = newKey;
    return newKey;
  } finally {
    // Release lock
    try {
      if (lockFd) await lockFd.close();
      const fs = await import('node:fs/promises');
      await fs.unlink(lockPath).catch(() => {});
    } catch {
      // best-effort cleanup
    }
  }
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

async function encrypt(plaintext: string): Promise<EncryptedKey> {
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const derivedKey = await deriveKey(salt);
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

async function decrypt(enc: EncryptedKey): Promise<string> {
  try {
    const derivedKey = await deriveKey(Buffer.from(enc.salt, 'hex'));
    const decipher = createDecipheriv('aes-256-gcm', derivedKey, Buffer.from(enc.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(enc.tag, 'hex'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(enc.ciphertext, 'hex')),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  } catch (error) {
    throw new Error(
      `Failed to decrypt data: invalid key or corrupted ciphertext. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function initDb(): Promise<void> {
  // Read DB first to check for existing encrypted data before generating keys
  const dbPath = getDbPath();
  await mkdir(dirname(dbPath), { recursive: true });
  const adapter = new JSONFile<DbSchema>(dbPath);
  db = new Low<DbSchema>(adapter, { models: [], keys: {} });
  await db.read();

  // Ensure encryption key is available BEFORE any DB write operations.
  // Checks for existing encrypted data to prevent accidental key regeneration.
  const hasExistingEncryptedData = Object.keys(db.data.keys ?? {}).length > 0;
  await ensureEncryptionKey(hasExistingEncryptedData);

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

export async function getApiKey(modelId: string): Promise<string | null> {
  const encryptedKey = ensureDb().data.keys[modelId];
  return encryptedKey ? await decrypt(encryptedKey) : null;
}

export async function setApiKey(modelId: string, key: string): Promise<void> {
  const database = ensureDb();
  database.data.keys[modelId] = await encrypt(key);
  await persistDb(database);
}
