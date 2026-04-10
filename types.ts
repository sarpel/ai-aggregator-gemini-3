export type ModelProviderId = string;


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
  ANALYZING = 'ANALYZING',
  SYNTHESIZING = 'SYNTHESIZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  TIMEOUT = 'TIMEOUT'
}

export enum SynthesizerMode {
  LLM = 'LLM'
}

export interface SynthesizerConfig {
  mode: SynthesizerMode;
  modelId: string;
  systemPrompt: string;
}

export type ApiStyle = 'OPENAI' | 'ANTHROPIC' | 'GEMINI';

export interface ModelConfig {
  id: string;
  name: string;
  avatarColor: string;
  description: string;
  provider: string;
  apiStyle: ApiStyle;
  modelName: string;
  endpoint: string;
  apiKey?: string;
  isCustom: boolean;
  isSimulated: boolean;
  enabled?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
}

export interface ModelResponse {
  provider: ModelProviderId;
  status: ModelStatus;
  text: string;
  error?: string;
  latency: number;
  progress: number; // 0-100
  tokenCount?: number;
}

export interface ConsensusResult {
  status: ConsensusStatus;
  text: string;
  confidence: number;
  contributors: { provider: ModelProviderId; weight: number }[];
}

export interface AppState {
  activeModels: string[];
  currentPrompt: string;
  isProcessing: boolean;
  responses: Record<string, ModelResponse>;
  consensus: ConsensusResult;
  synthesizerConfig: SynthesizerConfig;
  modelConfigs: ModelConfig[];
  configLoaded: boolean;
  history: { prompt: string; consensus: string; timestamp: number }[];
}

export type AppAction =
  | { type: 'SET_MODEL_CONFIGS'; configs: ModelConfig[] }
  | { type: 'ADD_MODEL_CONFIG'; config: ModelConfig }
  | { type: 'UPDATE_MODEL_CONFIG'; id: string; updates: Partial<ModelConfig> }
  | { type: 'REMOVE_MODEL_CONFIG'; id: string }
  | { type: 'SET_API_KEY'; payload: { provider: string; key: string } }
  | { type: 'TOGGLE_MODEL'; modelId: string }
  | { type: 'START_REQUEST'; payload: string }
  | { type: 'RETRY_REQUEST'; modelId: string }
  | { type: 'UPDATE_RESPONSE'; modelId: string; data: Partial<ModelResponse> }
  | { type: 'UPDATE_CONSENSUS'; payload: Partial<ConsensusResult> }
  | { type: 'SET_SYNTHESIZER_CONFIG'; payload: Partial<SynthesizerConfig> }
  | { type: 'RESET_SESSION'; }
  | { type: 'CLEAR_OUTPUTS'; }
  | { type: 'ADD_HISTORY'; payload: { prompt: string; consensus: string } };

export interface ProxyStreamRequest {
  modelId: string;
  endpoint: string;
  modelName: string;
  apiStyle: ApiStyle;
  messages: ChatMessage[];
  systemPrompt?: string;
}

export interface ModelConfigCreateDTO {
  name: string;
  endpoint: string;
  modelName: string;
  apiStyle: ApiStyle;
  apiKey: string;
  avatarColor?: string;
  description?: string;
}
