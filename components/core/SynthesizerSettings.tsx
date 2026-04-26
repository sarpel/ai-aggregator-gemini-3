
import React, { useEffect } from 'react';
import { SynthesizerConfig, AppAction, ModelConfig } from '../../types';
import { Cpu, X, Save } from 'lucide-react';
import CyberButton from '../ui/CyberButton';
import CyberTooltip from '../ui/CyberTooltip';

interface SynthesizerSettingsProps {
  config: SynthesizerConfig;
  dispatch: React.Dispatch<AppAction>;
  onClose: () => void;
  modelConfigs: ModelConfig[];
}

const SynthesizerSettings: React.FC<SynthesizerSettingsProps> = ({ config, dispatch, onClose, modelConfigs }) => {
  const handleChange = (field: keyof SynthesizerConfig, value: string) => {
    dispatch({ type: 'SET_SYNTHESIZER_CONFIG', payload: { [field]: value } });
  };

  useEffect(() => {
    const firstModel = modelConfigs[0];
    if (!firstModel) {
      return;
    }

    const modelExists = modelConfigs.some((m) => m.id === config.modelId);
    if (!config.modelId || !modelExists) {
      handleChange('modelId', firstModel.id);
    }
  }, [modelConfigs, config.modelId]);

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
          <div className="animate-fadeIn space-y-6">
              {/* Model Selection */}
              <div className="space-y-2">
                 <label className="text-gray-400 font-mono text-xs font-bold uppercase tracking-widest">Synthesis Model</label>
                 <CyberTooltip content="Choose which AI model synthesizes the final answer" position="top">
                   <select
                    value={modelConfigs.length === 0 ? '' : (modelConfigs.some(m => m.id === config.modelId) ? config.modelId : modelConfigs[0]?.id ?? '')}
                    onChange={(e) => handleChange('modelId', e.target.value)}
                    className="w-full bg-black border border-gray-700 text-white font-mono p-2 focus:border-cyber-pink focus:outline-none"
                 >
                    {modelConfigs.length === 0 ? (
                      <option value="" disabled>Önce bir model ekleyin</option>
                    ) : (
                      modelConfigs.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))
                    )}
                   </select>
                 </CyberTooltip>
              </div>

              {/* System Prompt Configuration */}
              <div className="space-y-2">
                <label className="text-gray-400 font-mono text-xs font-bold uppercase tracking-widest">Master Directive (System Prompt)</label>
                <CyberTooltip content="Define the persona and rules for the Consensus Engine" position="top">
                    <textarea
                        value={config.systemPrompt}
                        onChange={(e) => handleChange('systemPrompt', e.target.value)}
                        className="w-full h-32 bg-black border border-gray-700 text-cyber-pink font-mono text-sm p-3 focus:border-cyber-pink focus:outline-none resize-none"
                        placeholder="You are the arbiter of truth..."
                    />
                </CyberTooltip>
              </div>
            </div>
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
