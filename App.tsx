import { RotateCcw, Send, Settings, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { DEFAULT_MODELS } from './config';
import { INITIAL_RESPONSE_STATE, getAvailableModels, normalizeModelConfigs } from './constants';
import ResponseViewer from './components/core/ResponseViewer';
import SettingsPanel from './components/core/SettingsPanel';
import StatusMatrix from './components/core/StatusMatrix';
import CyberButton from './components/ui/CyberButton';
import CyberTooltip from './components/ui/CyberTooltip';
import { streamMock } from './services/apiAdapters/mockAdapter';
import { streamViaProxy } from './services/apiAdapters/proxyAdapter';
import { prepareSynthesisPrompt } from './services/consensus/consensusEngine';
import {
  ConsensusStatus,
  ModelStatus,
  SynthesizerMode,
  type AppAction,
  type AppState,
  type ChatMessage,
  type ModelConfig,
  type ModelResponse,
} from './types';

const createResponses = (configs: ModelConfig[]): Record<string, ModelResponse> => {
  const responses: Record<string, ModelResponse> = {};

  for (const config of configs) {
    responses[config.id] = INITIAL_RESPONSE_STATE(config.id);
  }

  return responses;
};

const createInitialState = (): AppState => ({
  modelConfigs: [],
  configLoaded: false,
  responses: {},
  activeModels: [],
  currentPrompt: '',
  isProcessing: false,
  consensus: {
    status: ConsensusStatus.IDLE,
    text: '',
    confidence: 0,
    contributors: [],
  },
  synthesizerConfig: {
    mode: SynthesizerMode.LLM,
    modelId: 'GEMINI',
    systemPrompt:
      'You are a Superintelligent Consensus Engine. Your goal is to synthesize the provided AI responses into a single, superior, "source of truth" answer. Resolve conflicts, verify facts, and merge insights.',
  },
  history: [],
});

const initialState = createInitialState();

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_MODEL_CONFIGS': {
      const normalizedConfigs = normalizeModelConfigs(action.configs);
      const responses = createResponses(normalizedConfigs);

      return {
        ...state,
        modelConfigs: normalizedConfigs,
        configLoaded: true,
        responses,
        activeModels: normalizedConfigs.map((config) => config.id),
      };
    }
    case 'ADD_MODEL_CONFIG': {
      return {
        ...state,
        modelConfigs: [...state.modelConfigs, action.config],
        responses: {
          ...state.responses,
          [action.config.id]: INITIAL_RESPONSE_STATE(action.config.id),
        },
        activeModels: [...state.activeModels, action.config.id],
      };
    }
    case 'UPDATE_MODEL_CONFIG': {
      return {
        ...state,
        modelConfigs: state.modelConfigs.map((config) =>
          config.id === action.id ? { ...config, ...action.updates } : config,
        ),
      };
    }
    case 'REMOVE_MODEL_CONFIG': {
      const nextResponses = { ...state.responses };
      delete nextResponses[action.id];

      return {
        ...state,
        modelConfigs: state.modelConfigs.filter((config) => config.id !== action.id),
        responses: nextResponses,
        activeModels: state.activeModels.filter((modelId) => modelId !== action.id),
      };
    }
    case 'TOGGLE_MODEL':
      return {
        ...state,
        activeModels: state.activeModels.includes(action.modelId)
          ? state.activeModels.filter((id) => id !== action.modelId)
          : [...state.activeModels, action.modelId],
      };
    case 'START_REQUEST': {
      const resetResponses = { ...state.responses };

      state.activeModels.forEach((modelId) => {
        resetResponses[modelId] = INITIAL_RESPONSE_STATE(modelId);
      });

      return {
        ...state,
        currentPrompt: action.payload,
        isProcessing: true,
        responses: resetResponses,
        consensus: {
          ...state.consensus,
          status: ConsensusStatus.ANALYZING,
          text: '',
          confidence: 0,
          contributors: [],
        },
      };
    }
    case 'RETRY_REQUEST':
      return {
        ...state,
        isProcessing: true,
        responses: {
          ...state.responses,
          [action.modelId]: INITIAL_RESPONSE_STATE(action.modelId),
        },
        consensus: {
          ...state.consensus,
          status: ConsensusStatus.ANALYZING,
        },
      };
    case 'UPDATE_RESPONSE': {
      const nextResponse = {
        ...(state.responses[action.modelId] ?? INITIAL_RESPONSE_STATE(action.modelId)),
        ...action.data,
      };

      return {
        ...state,
        responses: {
          ...state.responses,
          [action.modelId]: nextResponse,
        },
      };
    }
    case 'UPDATE_CONSENSUS': {
      const consensusPayload = { ...state.consensus, ...action.payload };
      const isTerminal =
        consensusPayload.status === ConsensusStatus.COMPLETED ||
        consensusPayload.status === ConsensusStatus.ERROR ||
        consensusPayload.status === ConsensusStatus.TIMEOUT;

      return {
        ...state,
        consensus: consensusPayload,
        isProcessing: isTerminal ? false : state.isProcessing,
      };
    }
    case 'SET_SYNTHESIZER_CONFIG':
      return {
        ...state,
        synthesizerConfig: { ...state.synthesizerConfig, ...action.payload },
      };
    case 'CLEAR_OUTPUTS':
      return {
        ...state,
        currentPrompt: '',
        isProcessing: false,
        responses: createResponses(state.modelConfigs),
        consensus: {
          status: ConsensusStatus.IDLE,
          text: '',
          confidence: 0,
          contributors: [],
        },
      };
    case 'ADD_HISTORY':
      return {
        ...state,
        history: [...state.history, { ...action.payload, timestamp: Date.now() }],
      };
    case 'RESET_SESSION': {
      const resetState = createInitialState();
      return {
        ...resetState,
        modelConfigs: state.modelConfigs,
        configLoaded: state.configLoaded,
        responses: createResponses(state.modelConfigs),
        activeModels: state.modelConfigs.map((config) => config.id),
      };
    }
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [promptInput, setPromptInput] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const synthesisTriggeredRef = useRef(false);

  useEffect(() => {
    fetch('/api/models')
      .then((response) => response.json())
      .then((payload: ModelConfig[] | { models?: ModelConfig[] }) => {
        const configs = normalizeModelConfigs(Array.isArray(payload) ? payload : payload.models ?? []);
        dispatch({
          type: 'SET_MODEL_CONFIGS',
          configs: configs.length > 0 ? configs : DEFAULT_MODELS,
        });
      })
      .catch(() => {
        dispatch({ type: 'SET_MODEL_CONFIGS', configs: DEFAULT_MODELS });
      });
  }, []);

  const runSynthesis = useCallback(async () => {
    const { modelId, systemPrompt } = state.synthesizerConfig;

    const synthesisPrompt = prepareSynthesisPrompt(state.currentPrompt, state.responses);
    dispatch({ type: 'UPDATE_CONSENSUS', payload: { status: ConsensusStatus.SYNTHESIZING, text: '' } });

    const modelConfig = state.modelConfigs.find((m) => m.id === modelId);
    if (!modelConfig) {
      dispatch({
        type: 'UPDATE_CONSENSUS',
        payload: { status: ConsensusStatus.ERROR, text: `Synthesis Error: Model "${modelId}" not found in configs` },
      });
      return;
    }

    let fullText = '';

    try {
      await streamViaProxy({
        modelId: modelConfig.id,
        apiStyle: modelConfig.apiStyle,
        endpoint: modelConfig.endpoint || undefined,
        modelName: modelConfig.modelName || undefined,
        messages: [{ role: 'user', content: synthesisPrompt, timestamp: Date.now() }],
        systemPrompt,
        onChunk: (chunk) => {
          fullText += chunk;
          dispatch({ type: 'UPDATE_CONSENSUS', payload: { text: fullText } });
        },
        onComplete: () => {
          dispatch({
            type: 'UPDATE_CONSENSUS',
            payload: { status: ConsensusStatus.COMPLETED, confidence: 0.95 },
          });
          dispatch({ type: 'ADD_HISTORY', payload: { prompt: state.currentPrompt, consensus: fullText } });
        },
        onError: (error) => {
          dispatch({
            type: 'UPDATE_CONSENSUS',
            payload: { status: ConsensusStatus.ERROR, text: `Synthesis Error: ${error}` },
          });
        },
      });
    } catch (error) {
      dispatch({
        type: 'UPDATE_CONSENSUS',
        payload: {
          status: ConsensusStatus.ERROR,
          text: `Synthesis Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      });
    }
  }, [state.currentPrompt, state.responses, state.synthesizerConfig, state.modelConfigs]);

  useEffect(() => {
    if (!state.isProcessing) {
      synthesisTriggeredRef.current = false;
      return;
    }

    if (state.activeModels.length === 0) {
      return;
    }

    const activeResponses = state.activeModels.map((modelId) => state.responses[modelId]);
    const allModelsFinished = activeResponses.every(
      (response) =>
        response &&
        (response.status === ModelStatus.COMPLETED ||
          response.status === ModelStatus.ERROR ||
          response.status === ModelStatus.TIMEOUT),
    );

    if (allModelsFinished && !synthesisTriggeredRef.current) {
      synthesisTriggeredRef.current = true;
      void runSynthesis();
    }
  }, [state.activeModels, state.isProcessing, state.responses, runSynthesis]);

  const triggerModelStream = useCallback(
    async (modelId: string, prompt: string) => {
      const config = state.modelConfigs.find((modelConfig) => modelConfig.id === modelId);
      if (!config) {
        return;
      }

      if (config.isSimulated) {
        await streamMock(modelId, prompt, (data) => {
          dispatch({ type: 'UPDATE_RESPONSE', modelId, data });
        });
        return;
      }

      const startTime = Date.now();
      let accumulatedText = '';

      dispatch({
        type: 'UPDATE_RESPONSE',
        modelId,
        data: {
          status: ModelStatus.CONNECTING,
          text: '',
          error: undefined,
          progress: 5,
          latency: 0,
          tokenCount: 0,
        },
      });

      const messages: ChatMessage[] = [{ role: 'user', content: prompt, timestamp: Date.now() }];

      try {
        await streamViaProxy({
          modelId,
          apiStyle: config.apiStyle,
          messages,
          onChunk: (chunk) => {
            accumulatedText += chunk;

            dispatch({
              type: 'UPDATE_RESPONSE',
              modelId,
              data: {
                text: accumulatedText,
                status: ModelStatus.STREAMING,
                error: undefined,
                latency: Date.now() - startTime,
                progress: Math.min(90, 10 + accumulatedText.length / 10),
                tokenCount: Math.ceil(accumulatedText.length / 4),
              },
            });
          },
          onComplete: () => {
            dispatch({
              type: 'UPDATE_RESPONSE',
              modelId,
              data: {
                text: accumulatedText,
                status: ModelStatus.COMPLETED,
                latency: Date.now() - startTime,
                progress: 100,
                tokenCount: Math.ceil(accumulatedText.length / 4),
              },
            });
          },
          onError: (error) => {
            dispatch({
              type: 'UPDATE_RESPONSE',
              modelId,
              data: {
                status: ModelStatus.ERROR,
                error,
                latency: Date.now() - startTime,
              },
            });
          },
        });
      } catch (error) {
        dispatch({
          type: 'UPDATE_RESPONSE',
          modelId,
          data: {
            status: ModelStatus.ERROR,
            error: error instanceof Error ? error.message : String(error),
            latency: Date.now() - startTime,
          },
        });
      }
    },
    [state.modelConfigs],
  );

  const handleSend = useCallback(() => {
    const prompt = promptInput.trim();
    if (!prompt || state.isProcessing || state.activeModels.length === 0) {
      return;
    }

    dispatch({ type: 'START_REQUEST', payload: prompt });
    synthesisTriggeredRef.current = false;

    state.activeModels.forEach((modelId) => {
      void triggerModelStream(modelId, prompt);
    });
  }, [promptInput, state.activeModels, state.isProcessing, triggerModelStream]);

  const handleRetry = useCallback(
    (modelId: string) => {
      if (!state.currentPrompt) {
        return;
      }

      synthesisTriggeredRef.current = false;
      dispatch({ type: 'RETRY_REQUEST', modelId });
      void triggerModelStream(modelId, state.currentPrompt);
    },
    [state.currentPrompt, triggerModelStream],
  );

  const handleClear = useCallback(() => {
    setPromptInput('');
  }, []);

  const handleNewQuery = useCallback(() => {
    setPromptInput('');
    dispatch({ type: 'CLEAR_OUTPUTS' });
  }, []);

  if (!state.configLoaded) {
    return <div className="loading-screen">Loading configuration...</div>;
  }

  const availableModels = getAvailableModels(state.modelConfigs);

  return (
    <div className="min-h-screen text-gray-300 font-sans selection:bg-cyber-neon selection:text-black flex flex-col relative">
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,#1a1a1a_0%,#050505_100%)]"></div>
      <div className="fixed top-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-neon to-transparent opacity-50 z-50"></div>

      <CyberTooltip content="Open neural configuration" position="left">
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-black/80 border border-cyber-gray text-xs font-mono text-cyber-neon hover:border-cyber-neon backdrop-blur hover:shadow-[0_0_10px_rgba(0,243,255,0.2)] transition-all rounded-sm"
        >
          <Settings size={14} />
          SETTINGS
        </button>
      </CyberTooltip>

      {isSettingsOpen && <SettingsPanel dispatch={dispatch} onClose={() => setIsSettingsOpen(false)} />}

      <header className="relative z-10 p-6 border-b border-cyber-gray/50 bg-black/40 backdrop-blur">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white flex items-center gap-2">
              NEURO<span className="text-cyber-neon">SYNC</span>
            </h1>
            <p className="text-xs font-mono text-gray-500 tracking-[0.3em] uppercase">
              Parallel Intelligence Aggregator
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {availableModels.map((config) => (
              <CyberTooltip key={config.id} content={`Toggle ${config.name} active/inactive`} position="bottom">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'TOGGLE_MODEL', modelId: config.id })}
                  className={`px-3 py-1 text-[10px] font-bold font-mono uppercase border rounded-sm transition-all ${
                    state.activeModels.includes(config.id)
                      ? 'bg-cyber-gray text-white border-cyber-neon/50 shadow-[0_0_8px_rgba(0,243,255,0.2)]'
                      : 'bg-transparent text-gray-600 border-gray-800 hover:border-gray-600'
                  }`}
                >
                  {config.name}
                </button>
              </CyberTooltip>
            ))}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col gap-6">
        <StatusMatrix
          activeModels={state.activeModels}
          modelResponses={state.responses}
          modelConfigs={state.modelConfigs}
        />

        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-[500px]">
          <div className="flex-1 h-[60vh] md:h-auto relative">
            <ResponseViewer
              responses={state.responses}
              consensus={state.consensus}
              activeModels={state.activeModels}
              synthesizerConfig={state.synthesizerConfig}
              dispatch={dispatch}
              onRetry={handleRetry}
              modelConfigs={state.modelConfigs}
            />
          </div>
        </div>

        <div className="mt-auto sticky bottom-6 z-40">
          <div className="relative bg-black border border-cyber-gray rounded-sm p-1 flex items-center shadow-[0_0_20px_rgba(0,0,0,0.8)]">
            <textarea
              value={promptInput}
              onChange={(event) => setPromptInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              disabled={state.isProcessing}
              placeholder="INITIALIZE NEURAL QUERY SEQUENCE..."
              className="flex-1 bg-transparent text-white font-mono text-sm p-4 focus:outline-none resize-none h-14 placeholder-gray-700"
            />
            <div className="flex items-center pr-2 gap-3">
              <CyberTooltip content="Clear text input buffer only" position="top">
                <button
                  type="button"
                  onClick={handleClear}
                  className="group flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                  aria-label="Clear text input"
                >
                  <RotateCcw size={14} className="group-hover:-rotate-180 transition-transform duration-300" />
                  <span className="hidden md:inline">CLEAR</span>
                </button>
              </CyberTooltip>

              <CyberTooltip content="Reset all outputs, history and state" position="top">
                <button
                  type="button"
                  onClick={handleNewQuery}
                  className="group flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono text-cyber-red/70 border border-transparent hover:border-cyber-red/50 hover:bg-cyber-red/10 hover:text-cyber-red transition-all"
                  aria-label="Start new query"
                >
                  <Trash2 size={14} />
                  <span className="hidden md:inline font-bold">NEW QUERY</span>
                </button>
              </CyberTooltip>

              <div className="w-[1px] h-8 bg-gray-800 mx-1"></div>

              <CyberTooltip content="Broadcast prompt to all active models" position="top">
                <CyberButton
                  onClick={handleSend}
                  disabled={state.isProcessing || !promptInput.trim() || state.activeModels.length === 0}
                  loading={state.isProcessing && state.consensus.status !== ConsensusStatus.COMPLETED}
                >
                  <Send size={16} className="ml-1" />
                </CyberButton>
              </CyberTooltip>
            </div>
          </div>
          <div className="absolute -bottom-2 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-cyber-neon/50 to-transparent"></div>
        </div>
      </main>
    </div>
  );
}
