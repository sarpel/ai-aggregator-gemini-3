
import { ModelConfig, ModelProvider, ModelStatus } from './types';
import { config } from './config';

export const AVAILABLE_MODELS: ModelConfig[] = config.models.map(m => ({
  ...m,
  id: m.id as ModelProvider // Ensure strict typing match
}));

export const APP_TIMEOUTS = config.appSettings;

export const INITIAL_RESPONSE_STATE = (provider: ModelProvider) => ({
  provider,
  status: ModelStatus.IDLE,
  text: '',
  latency: 0,
  progress: 0
});

export const MOCK_DELAY = 500;
