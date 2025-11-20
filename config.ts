
export const config = {
  "appSettings": {
    "connectionTimeoutMs": 30000,
    "generationTimeoutMs": 60000
  },
  "models": [
    {
      "id": "GEMINI",
      "name": "Gemini 2.5 Flash",
      "provider": "GEMINI",
      "avatarColor": "#00f3ff",
      "description": "Google Multimodal",
      "apiStyle": "GEMINI",
      "modelName": "gemini-2.5-flash",
      "isSimulated": false
    },
    {
      "id": "OPENAI",
      "name": "GPT-4o",
      "provider": "OPENAI",
      "avatarColor": "#10a37f",
      "description": "OpenAI Flagship",
      "apiStyle": "OPENAI",
      "endpoint": "https://api.openai.com/v1/chat/completions",
      "modelName": "gpt-4o",
      "isSimulated": false
    },
    {
      "id": "ANTHROPIC",
      "name": "Claude 3.5 Sonnet",
      "provider": "ANTHROPIC",
      "avatarColor": "#d97757",
      "description": "Anthropic Reasoning",
      "apiStyle": "ANTHROPIC",
      "endpoint": "https://api.anthropic.com/v1/messages",
      "modelName": "claude-3-5-sonnet-20240620",
      "isSimulated": false
    },
    {
      "id": "GROK",
      "name": "Grok Beta",
      "provider": "GROK",
      "avatarColor": "#fff",
      "description": "xAI Realtime",
      "apiStyle": "OPENAI",
      "endpoint": "https://api.grok.x.ai/v1/chat/completions",
      "modelName": "grok-beta",
      "isSimulated": false
    },
    {
      "id": "DEEPSEEK",
      "name": "DeepSeek V3",
      "provider": "DEEPSEEK",
      "avatarColor": "#4e61e6",
      "description": "DeepSeek Coding",
      "apiStyle": "OPENAI",
      "endpoint": "https://api.deepseek.com/chat/completions",
      "modelName": "deepseek-chat",
      "isSimulated": false
    }
  ]
};
