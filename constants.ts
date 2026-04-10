import { config } from './config';
import { ModelStatus, type ModelConfig } from './types';

export const APP_TIMEOUTS = config.appSettings;

type IncompleteModelConfig = Omit<ModelConfig, 'provider'> & { provider?: string };

export const normalizeModelConfig = (modelConfig: IncompleteModelConfig): ModelConfig => ({
  ...modelConfig,
  provider: modelConfig.provider ?? (modelConfig.isCustom ? 'CUSTOM' : modelConfig.id),
});

export const normalizeModelConfigs = (modelConfigs: IncompleteModelConfig[]): ModelConfig[] => (
  modelConfigs.map(normalizeModelConfig)
);

export const getAvailableModels = (modelConfigs: ModelConfig[]): ModelConfig[] =>
  normalizeModelConfigs(modelConfigs.filter((m) => m.enabled !== false));


export const INITIAL_RESPONSE_STATE = (modelId: string) => ({
  provider: modelId,
  status: ModelStatus.IDLE,
  text: '',
  latency: 0,
  progress: 0
});

export const MOCK_DELAY = 500;
