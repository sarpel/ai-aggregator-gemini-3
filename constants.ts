import { ModelConfig, ModelProvider, ModelStatus } from './types';

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: ModelProvider.GEMINI,
    name: 'Gemini 2.5 Flash',
    avatarColor: '#00f3ff', // Cyan
    description: 'Google Multimodal'
  },
  {
    id: ModelProvider.OPENAI,
    name: 'GPT-4o',
    avatarColor: '#10a37f', // Green
    description: 'OpenAI Flagship'
  },
  {
    id: ModelProvider.ANTHROPIC,
    name: 'Claude 3.5 Sonnet',
    avatarColor: '#d97757', // Orange
    description: 'Anthropic Reasoning'
  },
  {
    id: ModelProvider.GROK,
    name: 'Grok Beta',
    avatarColor: '#fff', // White
    description: 'xAI Realtime'
  },
  {
    id: ModelProvider.DEEPSEEK,
    name: 'DeepSeek V3',
    avatarColor: '#4e61e6', // Blue
    description: 'DeepSeek Coding'
  }
];

export const INITIAL_RESPONSE_STATE = (provider: ModelProvider) => ({
  provider,
  status: ModelStatus.IDLE,
  text: '',
  latency: 0,
  progress: 0
});

export const MOCK_DELAY = 500; // Simulated network delay for non-Gemini mocks
