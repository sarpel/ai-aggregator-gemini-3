
import type { ModelConfig } from './types';

export const config = {
  "appSettings": {
    "connectionTimeoutMs": 60000,
    "generationTimeoutMs": 60000
  }
};

export const DEFAULT_MODELS: ModelConfig[] = [
  {
    "id": "GEMINI",
    "name": "gemini-3-pro-preview",
    "provider": "GEMINI",
    "avatarColor": "#00f3ff",
    "description": "Google Gemini 3 Pro Preview",
    "apiStyle": "GEMINI",
    "endpoint": "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:streamGenerateContent",
    "modelName": "gemini-3-pro-preview",
    "isCustom": false,
    "isSimulated": false
  },
  {
    "id": "OPENAI",
    "name": "GPT-5.4",
    "provider": "OPENAI",
    "avatarColor": "#10a37f",
    "description": "OpenAI GPT-5.4",
    "apiStyle": "OPENAI",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "modelName": "gpt-5.4",
    "isCustom": false,
    "isSimulated": false
  },
  {
    "id": "ANTHROPIC",
    "name": "claude-sonnet-4.6",
    "provider": "ANTHROPIC",
    "avatarColor": "#d97757",
    "description": "Anthropic Sonnet 4.6",
    "apiStyle": "ANTHROPIC",
    "endpoint": "https://api.anthropic.com/v1/messages",
    "modelName": "claude-sonnet-4.6",
    "isCustom": false,
    "isSimulated": false
  },
  {
    "id": "ZAI",
    "name": "glm-5.1",
    "provider": "ZAI",
    "avatarColor": "#fff",
    "description": "Z.AI GLM 5.1",
    "apiStyle": "OPENAI",
    "endpoint": "https://api.z.ai/api/coding/paas/v4/chat/completions",
    "modelName": "glm-5.1",
    "isCustom": true,
    "isSimulated": false
  },
  {
    "id": "KIMI",
    "name": "Kimi K2.5",
    "provider": "KIMI",
    "avatarColor": "#4e61e6",
    "description": "Kimi K2.5",
    "apiStyle": "OPENAI",
    "endpoint": "https://api.kimi.com/coding/v1/chat/completions",
    "modelName": "kimi-for-coding",
    "isCustom": true,
    "isSimulated": false
  }
];
