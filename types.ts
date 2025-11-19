export enum ModelProvider {
  GEMINI = 'GEMINI',
  OPENAI = 'OPENAI', // Simulated/Placeholder for CORS reasons in frontend-only
  ANTHROPIC = 'ANTHROPIC', // Simulated/Placeholder
  GROK = 'GROK', // Simulated/Placeholder
  DEEPSEEK = 'DEEPSEEK' // Simulated/Placeholder
}

export enum ModelStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  STREAMING = 'STREAMING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  TIMEOUT = 'TIMEOUT'
}

export interface ModelConfig {
  id: ModelProvider;
  name: string;
  avatarColor: string;
  description: string;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
}

export interface ModelResponse {
  provider: ModelProvider;
  status: ModelStatus;
  text: string;
  error?: string;
  latency: number;
  progress: number; // 0-100
}

export interface ConsensusResult {
  text: string;
  confidence: number;
  contributors: { provider: ModelProvider; weight: number }[];
  isReady: boolean;
}

export interface AppState {
  apiKeyMap: Record<ModelProvider, string>;
  activeModels: ModelProvider[];
  currentPrompt: string;
  isProcessing: boolean;
  modelResponses: Record<ModelProvider, ModelResponse>;
  consensus: ConsensusResult;
  history: { prompt: string; consensus: string; timestamp: number }[];
}

export type AppAction =
  | { type: 'SET_API_KEY'; payload: { provider: ModelProvider; key: string } }
  | { type: 'TOGGLE_MODEL'; payload: ModelProvider }
  | { type: 'START_REQUEST'; payload: string }
  | { type: 'UPDATE_RESPONSE'; payload: { provider: ModelProvider; data: Partial<ModelResponse> } }
  | { type: 'SET_CONSENSUS'; payload: ConsensusResult }
  | { type: 'RESET_SESSION'; }
  | { type: 'ADD_HISTORY'; payload: { prompt: string; consensus: string } };
