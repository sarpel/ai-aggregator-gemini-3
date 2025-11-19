
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

export enum ConsensusStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING', // Waiting for other models
  SYNTHESIZING = 'SYNTHESIZING', // Streaming synthesis
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  TIMEOUT = 'TIMEOUT'
}

export enum SynthesizerMode {
  HEURISTIC = 'HEURISTIC',
  LLM = 'LLM'
}

export interface SynthesizerConfig {
  mode: SynthesizerMode;
  provider: 'GEMINI' | 'CUSTOM';
  customEndpoint?: string;
  customModelName?: string;
  customApiKey?: string;
  customApiStyle?: 'OPENAI' | 'ANTHROPIC';
  systemInstruction: string;
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
  status: ConsensusStatus;
  text: string;
  confidence: number;
  contributors: { provider: ModelProvider; weight: number }[];
}

export interface AppState {
  apiKeyMap: Record<ModelProvider, string>;
  activeModels: ModelProvider[];
  currentPrompt: string;
  isProcessing: boolean;
  modelResponses: Record<ModelProvider, ModelResponse>;
  consensus: ConsensusResult;
  synthesizerConfig: SynthesizerConfig;
  history: { prompt: string; consensus: string; timestamp: number }[];
}

export type AppAction =
  | { type: 'SET_API_KEY'; payload: { provider: ModelProvider; key: string } }
  | { type: 'TOGGLE_MODEL'; payload: ModelProvider }
  | { type: 'START_REQUEST'; payload: string }
  | { type: 'UPDATE_RESPONSE'; payload: { provider: ModelProvider; data: Partial<ModelResponse> } }
  | { type: 'UPDATE_CONSENSUS'; payload: Partial<ConsensusResult> }
  | { type: 'SET_SYNTHESIZER_CONFIG'; payload: Partial<SynthesizerConfig> }
  | { type: 'RESET_SESSION'; }
  | { type: 'CLEAR_OUTPUTS'; }
  | { type: 'ADD_HISTORY'; payload: { prompt: string; consensus: string } };