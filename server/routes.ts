import crypto from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { getModelConfigs, saveModelConfig, deleteModelConfig, getApiKey, setApiKey } from './db.js';

type ApiStyle = 'OPENAI' | 'ANTHROPIC' | 'GEMINI';

interface ModelConfigStored {
  id: string;
  name: string;
  endpoint: string;
  modelName: string;
  apiStyle: ApiStyle;
  avatarColor: string;
  description: string;
  isCustom: boolean;
}

interface CreateModelBody {
  name?: string;
  endpoint?: string;
  modelName?: string;
  apiStyle?: string;
  apiKey?: string;
  avatarColor?: string;
  description?: string;
}

interface UpdateModelBody {
  name?: string;
  endpoint?: string;
  modelName?: string;
  apiStyle?: string;
  apiKey?: string;
  avatarColor?: string;
  description?: string;
}

const router = express.Router();
const VALID_API_STYLES: ReadonlySet<ApiStyle> = new Set(['OPENAI', 'ANTHROPIC', 'GEMINI']);

function isApiStyle(value: unknown): value is ApiStyle {
  return typeof value === 'string' && VALID_API_STYLES.has(value as ApiStyle);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidEndpoint(endpoint: string, apiStyle: ApiStyle): boolean {
  if (apiStyle === 'GEMINI' && endpoint === '') {
    return true;
  }

  try {
    new URL(endpoint);
    return true;
  } catch {
    return false;
  }
}

function findModelConfig(models: ModelConfigStored[], id: string): ModelConfigStored | undefined {
  return models.find((model) => model.id === id);
}

function badRequest(res: Response, error: string): Response {
  return res.status(400).json({ error });
}

function getRouteId(req: Request): string | null {
  const { id } = req.params;
  return typeof id === 'string' ? id : null;
}

router.get('/models', async (_req: Request, res: Response) => {
  try {
    const models = getModelConfigs();
    res.json(models);
  } catch (err) {
    console.error('[GET /models] Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/models', async (req: Request, res: Response) => {
  const body = req.body as CreateModelBody;

  if (!isNonEmptyString(body.name)) {
    return badRequest(res, 'Field "name" is required');
  }

  if (!isNonEmptyString(body.modelName)) {
    return badRequest(res, 'Field "modelName" is required');
  }

  if (!isApiStyle(body.apiStyle)) {
    return badRequest(res, 'Field "apiStyle" must be one of OPENAI, ANTHROPIC, GEMINI');
  }

  if (typeof body.endpoint !== 'string') {
    return badRequest(res, 'Field "endpoint" is required');
  }

  if (!isValidEndpoint(body.endpoint, body.apiStyle)) {
    return badRequest(res, 'Field "endpoint" must be a valid URL');
  }

  if (body.apiKey !== undefined && !isNonEmptyString(body.apiKey)) {
    return badRequest(res, 'Field "apiKey" must be a non-empty string');
  }

  const config: ModelConfigStored = {
    id: crypto.randomUUID(),
    name: body.name,
    endpoint: body.endpoint,
    modelName: body.modelName,
    apiStyle: body.apiStyle,
    avatarColor: body.avatarColor ?? '',
    description: body.description ?? '',
    isCustom: true,
  };

  try {
    await saveModelConfig(config);

    if (body.apiKey !== undefined) {
      await setApiKey(config.id, body.apiKey);
    }
  } catch (err) {
    console.error('[POST /models] Error saving config/key:', err);
    return res.status(500).json({ error: 'Failed to save model configuration' });
  }

  return res.status(201).json(config);
});

router.put('/models/:id', async (req: Request, res: Response) => {
  const body = req.body as UpdateModelBody;
  const routeId = getRouteId(req);
  if (!routeId) {
    return badRequest(res, 'Route param "id" is required');
  }

  const existingConfig = findModelConfig(getModelConfigs(), routeId);

  if (!existingConfig) {
    return res.status(404).json({ error: 'Model not found' });
  }

  if (
    existingConfig.isCustom === false &&
    (body.endpoint !== undefined || body.modelName !== undefined || body.apiStyle !== undefined)
  ) {
    return res.status(403).json({ error: 'Cannot modify provider routing for default models' });
  }

  if (body.apiStyle !== undefined && !isApiStyle(body.apiStyle)) {
    return badRequest(res, 'Field "apiStyle" must be one of OPENAI, ANTHROPIC, GEMINI');
  }

  const nextApiStyle = body.apiStyle ?? existingConfig.apiStyle;

  if (body.endpoint !== undefined) {
    if (typeof body.endpoint !== 'string') {
      return badRequest(res, 'Field "endpoint" must be a string');
    }

    if (!isValidEndpoint(body.endpoint, nextApiStyle as ApiStyle)) {
      return badRequest(res, 'Field "endpoint" must be a valid URL');
    }
  }

  if (body.name !== undefined && !isNonEmptyString(body.name)) {
    return badRequest(res, 'Field "name" must be a non-empty string');
  }

  if (body.modelName !== undefined && !isNonEmptyString(body.modelName)) {
    return badRequest(res, 'Field "modelName" must be a non-empty string');
  }

  if (body.avatarColor !== undefined && typeof body.avatarColor !== 'string') {
    return badRequest(res, 'Field "avatarColor" must be a string');
  }

  if (body.description !== undefined && typeof body.description !== 'string') {
    return badRequest(res, 'Field "description" must be a string');
  }

  if (body.apiKey !== undefined && !isNonEmptyString(body.apiKey)) {
    return badRequest(res, 'Field "apiKey" must be a non-empty string');
  }

  const updatedConfig: ModelConfigStored = {
    ...existingConfig,
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.endpoint !== undefined ? { endpoint: body.endpoint } : {}),
    ...(body.modelName !== undefined ? { modelName: body.modelName } : {}),
    ...(body.apiStyle !== undefined ? { apiStyle: body.apiStyle as ApiStyle } : {}),
    ...(body.avatarColor !== undefined ? { avatarColor: body.avatarColor } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
  };

  try {
    await saveModelConfig(updatedConfig);

    if (body.apiKey !== undefined) {
      await setApiKey(routeId, body.apiKey);
    }
  } catch (err) {
    console.error(`[PUT /models/${routeId}] Error saving config/key:`, err);
    return res.status(500).json({ error: 'Failed to update model configuration' });
  }

  return res.status(200).json(updatedConfig);
});

router.delete('/models/:id', async (req: Request, res: Response) => {
  const routeId = getRouteId(req);
  if (!routeId) {
    return badRequest(res, 'Route param "id" is required');
  }

  const existingConfig = findModelConfig(getModelConfigs(), routeId);

  if (!existingConfig) {
    return res.status(404).json({ error: 'Model not found' });
  }

  if (existingConfig.isCustom === false) {
    return res.status(403).json({ error: 'Cannot delete default models' });
  }

  try {
    await deleteModelConfig(routeId);
  } catch (err) {
    console.error(`[DELETE /models/${routeId}] Error:`, err);
    return res.status(500).json({ error: 'Failed to delete model' });
  }

  return res.status(204).send();
});

router.post('/models/:id/key', async (req: Request, res: Response) => {
  const body = req.body as { apiKey?: string };
  const routeId = getRouteId(req);
  if (!routeId) {
    return badRequest(res, 'Route param "id" is required');
  }

  if (!isNonEmptyString(body.apiKey)) {
    return badRequest(res, 'Field "apiKey" must be a non-empty string');
  }

  const existingConfig = findModelConfig(getModelConfigs(), routeId);

  if (!existingConfig) {
    return res.status(404).json({ error: 'Model not found' });
  }

  try {
    await setApiKey(routeId, body.apiKey);
  } catch (err) {
    console.error(`[POST /models/${routeId}/key] Error:`, err);
    return res.status(500).json({ error: 'Failed to save API key' });
  }

  return res.status(200).json({ success: true });
});

router.get('/models/:id/key/status', async (req: Request, res: Response) => {
  const routeId = getRouteId(req);
  if (!routeId) {
    return badRequest(res, 'Route param "id" is required');
  }

  const existingConfig = findModelConfig(getModelConfigs(), routeId);

  if (!existingConfig) {
    return res.status(404).json({ error: 'Model not found' });
  }

  try {
    const key = await getApiKey(routeId);
    return res.status(200).json({ hasKey: key !== null });
  } catch (err) {
    console.error(`[GET /models/${routeId}/key/status] Error:`, err);
    return res.status(500).json({ error: 'Failed to check key status' });
  }
});

export default router;
