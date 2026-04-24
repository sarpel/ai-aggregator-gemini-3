
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
    "id": "MINIMAX",
    "name": "Minimax-2.7",
    "provider": "MINIMAX",
    "avatarColor": "#ff6b35",
    "description": "Minimax 2.7",
    "apiStyle": "OPENAI",
    "endpoint": "https://api.minimax.io/v1/chat/completions",
    "modelName": "Minimax-2.7",
    "isCustom": false,
    "isSimulated": false
  },
  {
    "id": "QWEN",
    "name": "Qwen-3.6 Plus",
    "provider": "QWEN",
    "avatarColor": "#6e40c9",
    "description": "Alibaba Qwen 3.6 Plus",
    "apiStyle": "OPENAI",
    "endpoint": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    "modelName": "Qwen-3.6 Plus",
    "isCustom": false,
    "isSimulated": false
  },
  {
    "id": "XAI",
    "name": "Grok-4.20",
    "provider": "XAI",
    "avatarColor": "#e8e8e8",
    "description": "xAI Grok 4.20 Reasoning",
    "apiStyle": "OPENAI",
    "endpoint": "https://api.x.ai/v1/chat/completions",
    "modelName": "grok-4.20-reasoning-latest",
    "isCustom": false,
    "isSimulated": false
  }
];
