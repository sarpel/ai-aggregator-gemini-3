
import React, { useReducer, useEffect, useRef } from 'react';
import { AppState, AppAction, ModelProvider, ModelStatus, SynthesizerMode, ConsensusStatus } from './types';
import { INITIAL_RESPONSE_STATE, AVAILABLE_MODELS } from './constants';
import { streamGemini } from './services/apiAdapters/geminiAdapter';
import { streamMock } from './services/apiAdapters/mockAdapter';
import { streamCustomLLM } from './services/apiAdapters/customAdapter';
import { generateHeuristicConsensus, prepareSynthesisPrompt } from './services/consensus/consensusEngine';
import { GoogleGenAI } from "@google/genai";
import StatusMatrix from './components/core/StatusMatrix';
import ResponseViewer from './components/core/ResponseViewer';
import CredentialManager from './components/core/CredentialManager';
import CyberButton from './components/ui/CyberButton';
import { Send, RotateCcw, Trash2 } from 'lucide-react';

const initialState: AppState = {
  apiKeyMap: {
    [ModelProvider.GEMINI]: '',
    [ModelProvider.OPENAI]: '',
    [ModelProvider.ANTHROPIC]: '',
    [ModelProvider.GROK]: '',
    [ModelProvider.DEEPSEEK]: ''
  },
  activeModels: [ModelProvider.GEMINI, ModelProvider.OPENAI, ModelProvider.ANTHROPIC],
  currentPrompt: '',
  isProcessing: false,
  modelResponses: {
    [ModelProvider.GEMINI]: INITIAL_RESPONSE_STATE(ModelProvider.GEMINI),
    [ModelProvider.OPENAI]: INITIAL_RESPONSE_STATE(ModelProvider.OPENAI),
    [ModelProvider.ANTHROPIC]: INITIAL_RESPONSE_STATE(ModelProvider.ANTHROPIC),
    [ModelProvider.GROK]: INITIAL_RESPONSE_STATE(ModelProvider.GROK),
    [ModelProvider.DEEPSEEK]: INITIAL_RESPONSE_STATE(ModelProvider.DEEPSEEK),
  },
  consensus: {
    status: ConsensusStatus.IDLE,
    text: '',
    confidence: 0,
    contributors: [],
  },
  synthesizerConfig: {
    mode: SynthesizerMode.HEURISTIC,
    provider: 'GEMINI',
    systemInstruction: 'You are a Superintelligent Consensus Engine. Your goal is to synthesize the provided AI responses into a single, superior, "source of truth" answer. Resolve conflicts, verify facts, and merge insights.',
    customEndpoint: 'http://localhost:11434/v1/chat/completions',
    customModelName: 'llama3',
    customApiKey: '',
    customApiStyle: 'OPENAI'
  },
  history: []
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_API_KEY':
      return {
        ...state,
        apiKeyMap: { ...state.apiKeyMap, [action.payload.provider]: action.payload.key }
      };
    case 'TOGGLE_MODEL':
      return {
        ...state,
        activeModels: state.activeModels.includes(action.payload)
          ? state.activeModels.filter(id => id !== action.payload)
          : [...state.activeModels, action.payload]
      };
    case 'START_REQUEST':
      // Reset responses for active models
      const resetResponses = { ...state.modelResponses };
      state.activeModels.forEach(id => {
        resetResponses[id] = INITIAL_RESPONSE_STATE(id);
      });
      return {
        ...state,
        currentPrompt: action.payload,
        isProcessing: true,
        modelResponses: resetResponses,
        consensus: { ...state.consensus, status: ConsensusStatus.ANALYZING, text: '', contributors: [] }
      };
    case 'UPDATE_RESPONSE':
      const updatedModelResp = {
        ...state.modelResponses[action.payload.provider],
        ...action.payload.data
      };
      return {
        ...state,
        modelResponses: {
          ...state.modelResponses,
          [action.payload.provider]: updatedModelResp
        }
      };
    case 'UPDATE_CONSENSUS':
      return {
        ...state,
        consensus: { ...state.consensus, ...action.payload }
      };
    case 'SET_SYNTHESIZER_CONFIG':
        return {
            ...state,
            synthesizerConfig: { ...state.synthesizerConfig, ...action.payload }
        };
    case 'CLEAR_OUTPUTS':
      return {
        ...state,
        currentPrompt: '',
        isProcessing: false,
        modelResponses: {
            [ModelProvider.GEMINI]: INITIAL_RESPONSE_STATE(ModelProvider.GEMINI),
            [ModelProvider.OPENAI]: INITIAL_RESPONSE_STATE(ModelProvider.OPENAI),
            [ModelProvider.ANTHROPIC]: INITIAL_RESPONSE_STATE(ModelProvider.ANTHROPIC),
            [ModelProvider.GROK]: INITIAL_RESPONSE_STATE(ModelProvider.GROK),
            [ModelProvider.DEEPSEEK]: INITIAL_RESPONSE_STATE(ModelProvider.DEEPSEEK),
        },
        consensus: {
            status: ConsensusStatus.IDLE,
            text: '',
            confidence: 0,
            contributors: [],
        }
      };
    case 'RESET_SESSION':
      return { ...initialState }; // Full purge
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [promptInput, setPromptInput] = React.useState('');
  const synthesisTriggeredRef = useRef(false);

  // Watcher for Synthesis Trigger
  useEffect(() => {
    if (!state.isProcessing) {
        synthesisTriggeredRef.current = false;
        return;
    }

    // check if all active models are completed or errored
    const activeResps = state.activeModels.map(id => state.modelResponses[id]);
    const allModelsFinished = activeResps.every(r => 
      r.status === ModelStatus.COMPLETED || 
      r.status === ModelStatus.ERROR || 
      r.status === ModelStatus.TIMEOUT
    );

    if (allModelsFinished && !synthesisTriggeredRef.current) {
      synthesisTriggeredRef.current = true;
      runSynthesis();
    }
  }, [state.modelResponses, state.activeModels, state.isProcessing]);

  const runSynthesis = async () => {
    const { mode, provider, systemInstruction, customEndpoint, customModelName, customApiKey, customApiStyle } = state.synthesizerConfig;

    if (mode === SynthesizerMode.HEURISTIC) {
        const result = generateHeuristicConsensus(state.modelResponses);
        dispatch({ type: 'UPDATE_CONSENSUS', payload: result });
    } else {
        // LLM Mode
        const synthesisPrompt = prepareSynthesisPrompt(state.currentPrompt, state.modelResponses);
        dispatch({ type: 'UPDATE_CONSENSUS', payload: { status: ConsensusStatus.SYNTHESIZING } });

        if (provider === 'GEMINI') {
            // Reuse Gemini Logic but with system prompt
            const apiKey = state.apiKeyMap[ModelProvider.GEMINI] || process.env.API_KEY;
            if (!apiKey) {
                dispatch({ type: 'UPDATE_CONSENSUS', payload: { status: ConsensusStatus.ERROR, text: "Synthesis Failed: Missing Gemini API Key" } });
                return;
            }
            
            try {
                const ai = new GoogleGenAI({ apiKey });
                const responseStream = await ai.models.generateContentStream({
                    model: 'gemini-2.5-flash',
                    contents: [{ parts: [{ text: synthesisPrompt }] }],
                    config: {
                        systemInstruction: systemInstruction
                    }
                });

                let fullText = '';
                for await (const chunk of responseStream) {
                    fullText += chunk.text || '';
                    dispatch({ type: 'UPDATE_CONSENSUS', payload: { text: fullText } });
                }
                dispatch({ type: 'UPDATE_CONSENSUS', payload: { status: ConsensusStatus.COMPLETED, confidence: 0.99 } });

            } catch (err: any) {
                dispatch({ type: 'UPDATE_CONSENSUS', payload: { status: ConsensusStatus.ERROR, text: `Synthesis Error: ${err.message}` } });
            }

        } else if (provider === 'CUSTOM') {
            // Use Custom Adapter
            await streamCustomLLM(
                customEndpoint || '',
                customApiKey || '',
                customModelName || '',
                [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: synthesisPrompt }
                ],
                customApiStyle || 'OPENAI',
                (text, status) => {
                    dispatch({ type: 'UPDATE_CONSENSUS', payload: { text, status, confidence: status === ConsensusStatus.COMPLETED ? 0.95 : 0 } });
                }
            );
        }
    }
  };

  const handleSend = () => {
    if (!promptInput.trim() || state.isProcessing) return;

    dispatch({ type: 'START_REQUEST', payload: promptInput });
    synthesisTriggeredRef.current = false;
    
    // Trigger API Calls
    state.activeModels.forEach(provider => {
      if (provider === ModelProvider.GEMINI) {
        streamGemini(promptInput, state.apiKeyMap[ModelProvider.GEMINI] || process.env.API_KEY || '', (data) => {
          dispatch({ type: 'UPDATE_RESPONSE', payload: { provider, data } });
        });
      } else {
        streamMock(provider, promptInput, (data) => {
          dispatch({ type: 'UPDATE_RESPONSE', payload: { provider, data } });
        });
      }
    });
  };

  const handleClear = () => {
      setPromptInput('');
  };

  const handleNewQuery = () => {
      setPromptInput('');
      dispatch({ type: 'CLEAR_OUTPUTS' });
  };

  return (
    <div className="min-h-screen text-gray-300 font-sans selection:bg-cyber-neon selection:text-black flex flex-col relative">
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,#1a1a1a_0%,#050505_100%)]"></div>
      <div className="fixed top-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-neon to-transparent opacity-50 z-50"></div>

      <CredentialManager apiKeyMap={state.apiKeyMap} dispatch={dispatch} />

      {/* Header */}
      <header className="relative z-10 p-6 border-b border-cyber-gray/50 bg-black/40 backdrop-blur">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white flex items-center gap-2">
              NEURO<span className="text-cyber-neon">SYNC</span>
            </h1>
            <p className="text-xs font-mono text-gray-500 tracking-[0.3em] uppercase">Parallel Intelligence Aggregator</p>
          </div>
          
          {/* Model Selector Pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {AVAILABLE_MODELS.map(model => (
              <button
                key={model.id}
                onClick={() => dispatch({ type: 'TOGGLE_MODEL', payload: model.id })}
                className={`px-3 py-1 text-[10px] font-bold font-mono uppercase border rounded-sm transition-all ${
                  state.activeModels.includes(model.id)
                    ? 'bg-cyber-gray text-white border-cyber-neon/50 shadow-[0_0_8px_rgba(0,243,255,0.2)]'
                    : 'bg-transparent text-gray-600 border-gray-800 hover:border-gray-600'
                }`}
              >
                {model.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col gap-6">
        
        <StatusMatrix 
          activeModels={state.activeModels}
          modelResponses={state.modelResponses}
        />

        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-[500px]">
          {/* Left: Response Viewer (Main Stage) */}
          <div className="flex-1 h-[60vh] md:h-auto relative">
            <ResponseViewer 
              responses={state.modelResponses}
              consensus={state.consensus}
              activeModels={state.activeModels}
              synthesizerConfig={state.synthesizerConfig}
              dispatch={dispatch}
            />
          </div>
        </div>

        {/* Input Console */}
        <div className="mt-auto sticky bottom-6 z-40">
           <div className="relative bg-black border border-cyber-gray rounded-sm p-1 flex items-center shadow-[0_0_20px_rgba(0,0,0,0.8)]">
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if(e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={state.isProcessing}
                placeholder="INITIALIZE NEURAL QUERY SEQUENCE..."
                className="flex-1 bg-transparent text-white font-mono text-sm p-4 focus:outline-none resize-none h-14 placeholder-gray-700"
              />
              <div className="flex items-center pr-2 gap-3">
                {/* Distinct Clear Input Button */}
                <button 
                  onClick={handleClear}
                  className="group flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                  title="Clear Text Buffer"
                  aria-label="Clear text input"
                >
                  <RotateCcw size={14} className="group-hover:-rotate-180 transition-transform duration-300" />
                  <span className="hidden md:inline">CLEAR</span>
                </button>

                {/* Distinct New Query Button */}
                <button 
                  onClick={handleNewQuery}
                  className="group flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono text-cyber-red/70 border border-transparent hover:border-cyber-red/50 hover:bg-cyber-red/10 hover:text-cyber-red transition-all"
                  title="Reset Session & Clear Board"
                  aria-label="Start new query"
                >
                  <Trash2 size={14} />
                  <span className="hidden md:inline font-bold">NEW QUERY</span>
                </button>

                <div className="w-[1px] h-8 bg-gray-800 mx-1"></div>
                
                <CyberButton 
                  onClick={handleSend} 
                  disabled={state.isProcessing || !promptInput.trim()}
                  loading={state.isProcessing && state.consensus.status !== ConsensusStatus.COMPLETED}
                >
                  <Send size={16} className="ml-1" />
                </CyberButton>
              </div>
           </div>
           {/* Decorative Line */}
           <div className="absolute -bottom-2 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-cyber-neon/50 to-transparent"></div>
        </div>

      </main>
    </div>
  );
}
