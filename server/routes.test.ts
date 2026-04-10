import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  getModelConfigs: vi.fn(),
  saveModelConfig: vi.fn(),
  deleteModelConfig: vi.fn(),
  getApiKey: vi.fn(),
  setApiKey: vi.fn(),
  initDb: vi.fn(),
}));

vi.mock('./db.js', () => dbMocks);

import router from './routes.js';

type HttpMethod = 'get' | 'post' | 'put' | 'delete';
type TestRouteLayer = {
  route?: {
    path: string;
    methods: Partial<Record<HttpMethod, boolean>>;
    stack: Array<{ handle: (req: unknown, res: unknown, next: unknown) => unknown }>;
  };
};

interface MockResponse {
  res: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
  getStatusCode: () => number;
  getBody: () => unknown;
}

function getRouteHandler(method: HttpMethod, path: string) {
  const layer = (router.stack as unknown as TestRouteLayer[]).find((entry) => {
    return entry.route?.path === path && entry.route.methods[method];
  });

  if (!layer?.route) {
    throw new Error(`Missing route ${method.toUpperCase()} ${path}`);
  }

  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function createMockResponse(): MockResponse {
  let statusCode = 200;
  let body: unknown;

  const res = {
    status: vi.fn().mockImplementation((code: number) => {
      statusCode = code;
      return res;
    }),
    json: vi.fn().mockImplementation((payload: unknown) => {
      body = payload;
      return res;
    }),
    send: vi.fn().mockImplementation((payload?: unknown) => {
      body = payload;
      return res;
    }),
  };

  return {
    res,
    getStatusCode: () => statusCode,
    getBody: () => body,
  };
}

async function invokeRoute(method: HttpMethod, path: string, options?: { params?: Record<string, string>; body?: unknown }) {
  const handler = getRouteHandler(method, path);
  const response = createMockResponse();
  const req = {
    params: options?.params ?? {},
    body: options?.body,
  };

  await handler(req as unknown, response.res as unknown, vi.fn());
  return response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('model routes', () => {
  it('GET /models returns all model configs without API keys', async () => {
    dbMocks.getModelConfigs.mockReturnValue([
      {
        id: 'OPENAI',
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        modelName: 'gpt-4.1',
        apiStyle: 'OPENAI',
        avatarColor: '#00ffcc',
        description: 'Default OpenAI model',
        isCustom: false,
      },
    ]);

    const response = await invokeRoute('get', '/models');

    expect(response.getStatusCode()).toBe(200);
    expect(response.getBody()).toEqual([
      expect.objectContaining({
        id: 'OPENAI',
        name: 'OpenAI',
      }),
    ]);
    expect(response.getBody()).not.toEqual([
      expect.objectContaining({ apiKey: expect.anything() }),
    ]);
  });

  it('POST /models creates a custom model and stores optional API key', async () => {
    const generatedModelId = 'generated-model-id-0000-0000-0000-000000000000';
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(generatedModelId);
    dbMocks.saveModelConfig.mockResolvedValue(undefined);
    dbMocks.setApiKey.mockResolvedValue(undefined);

    const response = await invokeRoute('post', '/models', {
      body: {
        name: 'Custom OpenAI',
        endpoint: 'https://example.com/v1/chat/completions',
        modelName: 'custom-model',
        apiStyle: 'OPENAI',
        apiKey: 'secret-key',
        avatarColor: '#112233',
        description: 'Custom endpoint',
      },
    });

    expect(response.getStatusCode()).toBe(201);
    expect(response.getBody()).toEqual({
      id: generatedModelId,
      name: 'Custom OpenAI',
      endpoint: 'https://example.com/v1/chat/completions',
      modelName: 'custom-model',
      apiStyle: 'OPENAI',
      avatarColor: '#112233',
      description: 'Custom endpoint',
      isCustom: true,
    });
    expect(dbMocks.saveModelConfig).toHaveBeenCalledWith(expect.objectContaining({
      id: generatedModelId,
      isCustom: true,
    }));
    expect(dbMocks.setApiKey).toHaveBeenCalledWith(generatedModelId, 'secret-key');
  });

  it('POST /models returns 400 when name is missing', async () => {
    const response = await invokeRoute('post', '/models', {
      body: {
        endpoint: 'https://example.com/v1/chat/completions',
        modelName: 'custom-model',
        apiStyle: 'OPENAI',
      },
    });

    expect(response.getStatusCode()).toBe(400);
    expect(response.getBody()).toEqual({ error: 'Field "name" is required' });
  });

  it('POST /models returns 400 when apiStyle is invalid', async () => {
    const response = await invokeRoute('post', '/models', {
      body: {
        name: 'Broken',
        endpoint: 'https://example.com',
        modelName: 'broken-model',
        apiStyle: 'INVALID',
      },
    });

    expect(response.getStatusCode()).toBe(400);
    expect(response.getBody()).toEqual({ error: 'Field "apiStyle" must be one of OPENAI, ANTHROPIC, GEMINI' });
  });

  it('POST /models/:id/key stores an API key for an existing model', async () => {
    dbMocks.getModelConfigs.mockReturnValue([
      {
        id: 'custom-1',
        name: 'Custom',
        endpoint: 'https://example.com',
        modelName: 'model',
        apiStyle: 'OPENAI',
        avatarColor: '',
        description: '',
        isCustom: true,
      },
    ]);
    dbMocks.setApiKey.mockResolvedValue(undefined);

    const response = await invokeRoute('post', '/models/:id/key', {
      params: { id: 'custom-1' },
      body: { apiKey: 'encrypted-me' },
    });

    expect(response.getStatusCode()).toBe(200);
    expect(response.getBody()).toEqual({ success: true });
    expect(dbMocks.setApiKey).toHaveBeenCalledWith('custom-1', 'encrypted-me');
  });

  it('DELETE /models/:id returns 403 for default models', async () => {
    dbMocks.getModelConfigs.mockReturnValue([
      {
        id: 'OPENAI',
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        modelName: 'gpt-4.1',
        apiStyle: 'OPENAI',
        avatarColor: '#00ffcc',
        description: 'Default',
        isCustom: false,
      },
    ]);

    const response = await invokeRoute('delete', '/models/:id', {
      params: { id: 'OPENAI' },
    });

    expect(response.getStatusCode()).toBe(403);
    expect(response.getBody()).toEqual({ error: 'Cannot delete default models' });
    expect(dbMocks.deleteModelConfig).not.toHaveBeenCalled();
  });

  it('DELETE /models/:id deletes custom models', async () => {
    dbMocks.getModelConfigs.mockReturnValue([
      {
        id: 'custom-2',
        name: 'Custom',
        endpoint: 'https://example.com',
        modelName: 'custom-model',
        apiStyle: 'OPENAI',
        avatarColor: '',
        description: '',
        isCustom: true,
      },
    ]);
    dbMocks.deleteModelConfig.mockResolvedValue(undefined);

    const response = await invokeRoute('delete', '/models/:id', {
      params: { id: 'custom-2' },
    });

    expect(response.getStatusCode()).toBe(204);
    expect(dbMocks.deleteModelConfig).toHaveBeenCalledWith('custom-2');
  });

  it('GET /models/:id/key/status returns hasKey false when no key exists', async () => {
    dbMocks.getModelConfigs.mockReturnValue([
      {
        id: 'custom-3',
        name: 'Custom',
        endpoint: 'https://example.com',
        modelName: 'custom-model',
        apiStyle: 'OPENAI',
        avatarColor: '',
        description: '',
        isCustom: true,
      },
    ]);
    dbMocks.getApiKey.mockReturnValue(null);

    const response = await invokeRoute('get', '/models/:id/key/status', {
      params: { id: 'custom-3' },
    });

    expect(response.getStatusCode()).toBe(200);
    expect(response.getBody()).toEqual({ hasKey: false });
  });

  it('GET /models/:id/key/status returns hasKey true when a key exists', async () => {
    dbMocks.getModelConfigs.mockReturnValue([
      {
        id: 'custom-4',
        name: 'Custom',
        endpoint: 'https://example.com',
        modelName: 'custom-model',
        apiStyle: 'OPENAI',
        avatarColor: '',
        description: '',
        isCustom: true,
      },
    ]);
    dbMocks.getApiKey.mockReturnValue('encrypted-key');

    const response = await invokeRoute('get', '/models/:id/key/status', {
      params: { id: 'custom-4' },
    });

    expect(response.getStatusCode()).toBe(200);
    expect(response.getBody()).toEqual({ hasKey: true });
  });
});
