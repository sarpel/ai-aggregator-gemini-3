
export const config = {
  "appSettings": {
    "connectionTimeoutMs": 60000,
    "generationTimeoutMs": 60000
  },
  "models": [
    {
      "id": "GEMINI",
      "name": "Gemini 2.5 Flash",
      "provider": "GEMINI",
      "avatarColor": "#00f3ff",
      "description": "Google Multimodal Fast",
      "apiStyle": "GEMINI",
      "modelName": "gemini-2.5-flash",
      "isSimulated": false
    },
    {
      "id": "OPENAI",
      "name": "GPT-4o",
      "provider": "OPENAI",
      "avatarColor": "#10a37f",
      "description": "OpenAI Omni",
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
      "description": "Anthropic New Sonnet",
      "apiStyle": "ANTHROPIC",
      "endpoint": "https://api.anthropic.com/v1/messages",
      "modelName": "claude-3-5-sonnet-20241022",
      "isSimulated": false
    },
    {
      "id": "GROK",
      "name": "Grok 2",
      "provider": "GROK",
      "avatarColor": "#fff",
      "description": "xAI Grok 2",
      "apiStyle": "OPENAI",
      "endpoint": "https://api.x.ai/v1/chat/completions",
      "modelName": "grok-2-latest",
      "isSimulated": false
    },
    {
      "id": "DEEPSEEK",
      "name": "DeepSeek V3",
      "provider": "DEEPSEEK",
      "avatarColor": "#4e61e6",
      "description": "DeepSeek Chat V3",
      "apiStyle": "OPENAI",
      "endpoint": "https://api.deepseek.com/chat/completions",
      "modelName": "deepseek-chat",
      "isSimulated": false
    }
  ]
};