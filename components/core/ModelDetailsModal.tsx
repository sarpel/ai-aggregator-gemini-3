import React from 'react';
import { ModelConfig, ModelResponse, ModelStatus } from '../../types';
import { X, Server, Activity, Database, Hash, Clock, Zap, AlertTriangle, Globe, Terminal } from 'lucide-react';
import ModelAvatar from '../ui/ModelAvatar';
import CyberButton from '../ui/CyberButton';

interface ModelDetailsModalProps {
  model: ModelConfig;
  response: ModelResponse;
  onClose: () => void;
}

const ModelDetailsModal: React.FC<ModelDetailsModalProps> = ({ model, response, onClose }) => {
  const isError = response.status === ModelStatus.ERROR || response.status === ModelStatus.TIMEOUT;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fadeIn">
      <div 
        className="w-full max-w-lg bg-[#050505] border shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-sm relative overflow-hidden flex flex-col max-h-[90vh]"
        style={{ borderColor: model.avatarColor, boxShadow: `0 0 30px ${model.avatarColor}20` }}
      >
        {/* Decorative Header Line */}
        <div className="h-1 w-full" style={{ backgroundColor: model.avatarColor }}></div>
        
        {/* Header */}
        <div className="p-6 flex justify-between items-start bg-gradient-to-b from-white/5 to-transparent">
          <div className="flex items-center gap-4">
            <div className="scale-125 origin-left">
                <ModelAvatar 
                    providerId={model.id} 
                    name={model.name} 
                    color={model.avatarColor} 
                    status={response.status} 
                    mini={false} 
                    progress={response.progress}
                />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-white uppercase">
                {model.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-white/10 text-gray-300">
                    {model.provider}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase border ${
                    isError ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-gray-700 text-gray-400'
                }`}>
                    {response.status}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            
            {/* Description */}
            <div className="bg-cyber-gray/10 p-4 rounded border border-gray-800">
                <p className="text-gray-300 text-sm italic">"{model.description}"</p>
            </div>

            {/* Technical Specs Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1">
                        <Hash size={10} /> Technical Model Name
                    </label>
                    <div className="font-mono text-xs text-cyber-neon bg-black p-2 border border-gray-800 rounded truncate" title={model.modelName}>
                        {model.modelName}
                    </div>
                </div>
                
                <div className="space-y-1">
                    <label className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1">
                        <Terminal size={10} /> API Protocol
                    </label>
                    <div className="font-mono text-xs text-white bg-black p-2 border border-gray-800 rounded flex items-center gap-2">
                        {model.apiStyle === 'OPENAI' && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
                        {model.apiStyle === 'ANTHROPIC' && <span className="w-2 h-2 bg-orange-500 rounded-full"></span>}
                        {model.apiStyle === 'GEMINI' && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                        {model.apiStyle}
                    </div>
                </div>

                <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1">
                        <Globe size={10} /> Endpoint URL
                    </label>
                    <div className="font-mono text-[10px] text-gray-400 bg-black p-2 border border-gray-800 rounded truncate">
                        {model.endpoint || "(Native / SDK Integration)"}
                    </div>
                </div>
            </div>

            {/* Live Performance Stats */}
            <div className="space-y-2">
                <label className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1 border-b border-gray-800 pb-1 mb-2">
                    <Activity size={10} /> Live Telemetry
                </label>
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-black/50 p-3 rounded border border-gray-800 flex flex-col items-center justify-center gap-1">
                        <Clock size={16} className="text-cyber-pink" />
                        <span className="text-[10px] text-gray-500 uppercase">Latency</span>
                        <span className="text-lg font-mono font-bold text-white">{(response.latency / 1000).toFixed(2)}s</span>
                    </div>
                    <div className="bg-black/50 p-3 rounded border border-gray-800 flex flex-col items-center justify-center gap-1">
                        <Database size={16} className="text-cyber-yellow" />
                        <span className="text-[10px] text-gray-500 uppercase">Est. Tokens</span>
                        <span className="text-lg font-mono font-bold text-white">{response.tokenCount || 0}</span>
                    </div>
                    <div className="bg-black/50 p-3 rounded border border-gray-800 flex flex-col items-center justify-center gap-1">
                        <Zap size={16} className={response.status === ModelStatus.STREAMING ? 'text-cyber-neon' : 'text-gray-600'} />
                        <span className="text-[10px] text-gray-500 uppercase">Throughput</span>
                        <span className="text-lg font-mono font-bold text-white">
                            {response.latency > 0 && response.tokenCount 
                                ? (response.tokenCount / (response.latency / 1000)).toFixed(0) 
                                : 0
                            } T/s
                        </span>
                    </div>
                </div>
            </div>

            {isError && (
                <div className="bg-red-900/20 border border-red-500/50 p-4 rounded flex items-start gap-3">
                    <AlertTriangle className="text-red-500 shrink-0" size={20} />
                    <div>
                        <h4 className="text-red-400 font-bold text-xs uppercase mb-1">Error Diagnostics</h4>
                        <p className="text-xs text-red-200 font-mono break-all">{response.error}</p>
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-black/40 border-t border-gray-800 flex justify-end">
           <CyberButton onClick={onClose} variant="secondary" className="text-xs px-4 py-2">
             CLOSE DETAILS
           </CyberButton>
        </div>
      </div>
    </div>
  );
};

export default ModelDetailsModal;
