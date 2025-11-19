import React, { useReducer, useEffect } from 'react';
import { AppState, AppAction, ModelProvider, ModelStatus } from './types';
import { INITIAL_RESPONSE_STATE, AVAILABLE_MODELS } from './constants';
import { streamGemini } from './services/apiAdapters/geminiAdapter';
import { streamMock } from './services/apiAdapters/mockAdapter';
import { generateConsensus } from './services/consensus/consensusEngine';
import StatusMatrix from './components/core/StatusMatrix';
import ResponseViewer from './components/core/ResponseViewer';
import CredentialManager from './components/core/CredentialManager';
import CyberButton from './components/ui/CyberButton';
import { Send, RotateCcw } from 'lucide-react';

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
    text: '',
    confidence: 0,
    contributors: [],
    isReady: false
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
        consensus: { ...state.consensus, isReady: false, text: '' }
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
    case 'SET_CONSENSUS':
      return {
        ...state,
        isProcessing: false, // Assume finished when consensus is set (or handle separately)
        consensus: action.payload
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

  // Consensus Polling/Trigger
  useEffect(() => {
    if (!state.isProcessing) return;

    // check if all active models are completed or errored
    const activeResps = state.activeModels.map(id => state.modelResponses[id]);
    const allFinished = activeResps.every(r => 
      r.status === ModelStatus.COMPLETED || 
      r.status === ModelStatus.ERROR || 
      r.status === ModelStatus.TIMEOUT
    );

    if (allFinished) {
      const result = generateConsensus(state.modelResponses);
      dispatch({ type: 'SET_CONSENSUS', payload: result });
    }
  }, [state.modelResponses, state.activeModels, state.isProcessing]);

  const handleSend = () => {
    if (!promptInput.trim() || state.isProcessing) return;

    dispatch({ type: 'START_REQUEST', payload: promptInput });
    
    // Trigger API Calls
    state.activeModels.forEach(provider => {
      if (provider === ModelProvider.GEMINI) {
        streamGemini(promptInput, state.apiKeyMap[ModelProvider.GEMINI] || process.env.API_KEY || '', (data) => {
          dispatch({ type: 'UPDATE_RESPONSE', payload: { provider, data } });
        });
      } else {
        // Use mock for others unless real adapter implemented with proxy
        streamMock(provider, promptInput, (data) => {
          dispatch({ type: 'UPDATE_RESPONSE', payload: { provider, data } });
        });
      }
    });
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
              <div className="flex items-center pr-2 gap-2">
                <button 
                  onClick={() => setPromptInput('')}
                  className="p-2 text-gray-600 hover:text-cyber-red transition-colors"
                  title="Clear Buffer"
                >
                  <RotateCcw size={18} />
                </button>
                <CyberButton 
                  onClick={handleSend} 
                  disabled={state.isProcessing || !promptInput.trim()}
                  loading={state.isProcessing}
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
