
import React from 'react';
import { SynthesizerConfig, SynthesizerMode, AppAction } from '../../types';
import { Cpu, X, Settings, Save, Server, Network } from 'lucide-react';
import CyberButton from '../ui/CyberButton';

interface SynthesizerSettingsProps {
  config: SynthesizerConfig;
  dispatch: React.Dispatch<AppAction>;
  onClose: () => void;
}

const SynthesizerSettings: React.FC<SynthesizerSettingsProps> = ({ config, dispatch, onClose }) => {
  const handleChange = (field: keyof SynthesizerConfig, value: any) => {
    dispatch({ type: 'SET_SYNTHESIZER_CONFIG', payload: { [field]: value } });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl bg-cyber-black border border-cyber-neon shadow-[0_0_50px_rgba(0,243,255,0.1)] rounded-sm relative overflow-hidden">
        {/* Header */}
        <div className="bg-cyber-gray/20 border-b border-cyber-neon/30 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-black tracking-tighter text-white flex items-center gap-3">
            <Cpu className="text-cyber-neon animate-pulse" />
            NEURAL CORE CONFIGURATION
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-cyber-red transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Mode Selection */}
          <div className="space-y-4">
            <label className="text-cyber-neon font-mono text-xs font-bold uppercase tracking-widest block">Synthesis Mode</label>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleChange('mode', SynthesizerMode.HEURISTIC)}
                className={`p-4 border rounded-sm text-left transition-all ${config.mode === SynthesizerMode.HEURISTIC ? 'border-cyber-neon bg-cyber-neon/10 text-white' : 'border-gray-800 text-gray-500 hover:border-gray-600'}`}
              >
                <div className="font-bold font-mono mb-1">HEURISTIC (FAST)</div>
                <div className="text-xs">Basic algorithmic merging. Instant, no extra API cost.</div>
              </button>
              <button 
                onClick={() => handleChange('mode', SynthesizerMode.LLM)}
                className={`p-4 border rounded-sm text-left transition-all ${config.mode === SynthesizerMode.LLM ? 'border-cyber-pink bg-cyber-pink/10 text-white' : 'border-gray-800 text-gray-500 hover:border-gray-600'}`}
              >
                <div className="font-bold font-mono mb-1">LLM SYNTHESIS (SMART)</div>
                <div className="text-xs">Uses a Master LLM to harmonize and verify all inputs.</div>
              </button>
            </div>
          </div>

          {config.mode === SynthesizerMode.LLM && (
            <div className="animate-fadeIn space-y-6 border-l-2 border-cyber-pink pl-6">
              {/* Provider Selection */}
              <div className="space-y-2">
                 <label className="text-gray-400 font-mono text-xs font-bold uppercase tracking-widest">Core Provider</label>
                 <select 
                    value={config.provider}
                    onChange={(e) => handleChange('provider', e.target.value)}
                    className="w-full bg-black border border-gray-700 text-white font-mono p-2 focus:border-cyber-pink focus:outline-none"
                 >
                    <option value="GEMINI">Gemini (Uses App Key)</option>
                    <option value="CUSTOM">Custom / Local / 3rd Party</option>
                 </select>
              </div>

              {config.provider === 'CUSTOM' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-cyber-gray/10 rounded border border-gray-800">
                  
                  {/* API Style Selector */}
                  <div className="md:col-span-2 space-y-2">
                     <label className="text-xs text-gray-500 flex items-center gap-2">
                       <Network size={12} /> API Style / Protocol
                     </label>
                     <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="apiStyle"
                                checked={config.customApiStyle === 'OPENAI' || !config.customApiStyle}
                                onChange={() => handleChange('customApiStyle', 'OPENAI')}
                                className="accent-cyber-pink"
                            />
                            <span className="text-sm font-mono">OpenAI Compatible</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="apiStyle"
                                checked={config.customApiStyle === 'ANTHROPIC'}
                                onChange={() => handleChange('customApiStyle', 'ANTHROPIC')}
                                className="accent-cyber-pink"
                            />
                            <span className="text-sm font-mono">Anthropic</span>
                        </label>
                     </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-500">Endpoint URL</label>
                    <div className="flex items-center bg-black border border-gray-700">
                        <Server size={14} className="mx-2 text-gray-500" />
                        <input 
                            type="text" 
                            value={config.customEndpoint || ''}
                            onChange={(e) => handleChange('customEndpoint', e.target.value)}
                            placeholder={config.customApiStyle === 'ANTHROPIC' ? "https://api.anthropic.com/v1/messages" : "http://localhost:11434/v1/chat/completions"}
                            className="w-full bg-transparent text-white font-mono text-xs p-2 outline-none"
                        />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500">Model Name</label>
                    <input 
                        type="text" 
                        value={config.customModelName || ''}
                        onChange={(e) => handleChange('customModelName', e.target.value)}
                        placeholder={config.customApiStyle === 'ANTHROPIC' ? "claude-3-sonnet-20240229" : "llama3"}
                        className="w-full bg-black border border-gray-700 text-white font-mono text-xs p-2 outline-none focus:border-cyber-pink"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs text-gray-500">API Key (Optional)</label>
                    <input 
                        type="password" 
                        value={config.customApiKey || ''}
                        onChange={(e) => handleChange('customApiKey', e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-black border border-gray-700 text-white font-mono text-xs p-2 outline-none focus:border-cyber-pink"
                    />
                  </div>
                </div>
              )}

              {/* System Prompt Configuration */}
              <div className="space-y-2">
                <label className="text-gray-400 font-mono text-xs font-bold uppercase tracking-widest">Master Directive (System Prompt)</label>
                <textarea 
                    value={config.systemInstruction}
                    onChange={(e) => handleChange('systemInstruction', e.target.value)}
                    className="w-full h-32 bg-black border border-gray-700 text-cyber-pink font-mono text-sm p-3 focus:border-cyber-pink focus:outline-none resize-none"
                    placeholder="You are the arbiter of truth..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-cyber-gray/50 flex justify-end">
          <CyberButton onClick={onClose} variant="primary">
            <Save size={16} className="mr-2" />
            INITIALIZE CORE
          </CyberButton>
        </div>
      </div>
    </div>
  );
};

export default SynthesizerSettings;
