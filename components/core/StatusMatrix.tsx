import React, { useState } from 'react';
import { ModelProvider, AppState, ModelStatus } from '../../types';
import { AVAILABLE_MODELS } from '../../constants';
import ModelAvatar from '../ui/ModelAvatar';
import CyberTooltip from '../ui/CyberTooltip';
import ModelDetailsModal from './ModelDetailsModal';

interface StatusMatrixProps {
  activeModels: ModelProvider[];
  modelResponses: Record<ModelProvider, any>;
}

const StatusMatrix: React.FC<StatusMatrixProps> = ({ activeModels, modelResponses }) => {
  const [selectedModelId, setSelectedModelId] = useState<ModelProvider | null>(null);

  const selectedModelConfig = selectedModelId ? AVAILABLE_MODELS.find(m => m.id === selectedModelId) : null;
  const selectedModelResponse = selectedModelId ? modelResponses[selectedModelId] : null;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {AVAILABLE_MODELS.map((model) => {
          const isActive = activeModels.includes(model.id);
          const response = modelResponses[model.id];
          const status = isActive ? response?.status || ModelStatus.IDLE : ModelStatus.IDLE;
          const hasData = isActive && response && response.text.length > 0;
          const isCompleted = status === ModelStatus.COMPLETED;
          const isError = status === ModelStatus.ERROR || status === ModelStatus.TIMEOUT;
          
          // Determine overlay animation based on status
          let overlayClass = '';
          let overlayStyle = {};

          if (status === ModelStatus.STREAMING) {
              // Standard active stream: Green Pulse
              overlayClass = 'bg-green-500/20 animate-pulse-green';
          } else if (status === ModelStatus.TIMEOUT || status === ModelStatus.ERROR) {
              // Failed: Red Pulse
              overlayClass = 'bg-red-500/20 animate-pulse-red';
          } else if (status === ModelStatus.CONNECTING) {
              // Connecting Phase:
              // 1. 0-30s: No major color, just subtle text activity (handled by avatar icon)
              // 2. >30s: Yellow Pulse Warning (Delayed Animation)
              overlayClass = 'bg-yellow-500/20 animate-delayed-fade-in';
              overlayStyle = { 
                  animation: 'delayedFadeIn 0.1s linear 30s forwards, pulseYellow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite 30s' 
              };
          }

          return (
            <div 
              key={model.id}
              className={`relative p-3 border transition-all duration-300 overflow-hidden group flex flex-col ${
                isActive 
                  ? isError 
                    ? 'border-red-500/50 bg-red-900/10 shadow-[0_0_15px_rgba(255,42,42,0.15)]' 
                    : 'border-cyber-gray bg-cyber-gray/10' 
                  : 'border-transparent opacity-30 grayscale'
              } rounded-sm`}
            >
              {/* Status Animation Overlay */}
              {isActive && status !== ModelStatus.IDLE && status !== ModelStatus.COMPLETED && (
                 <div className={`absolute inset-0 pointer-events-none z-0 ${overlayClass}`} style={overlayStyle}></div>
              )}

              {/* Header Info */}
              <div className="flex items-center gap-3 relative z-10">
                <CyberTooltip content={isActive ? "Click to view model details" : "Model Inactive"} position="right">
                  <div 
                    className={`cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95`}
                    onClick={() => isActive && setSelectedModelId(model.id)}
                  >
                    <ModelAvatar 
                      providerId={model.id}
                      name={model.name} 
                      color={isError ? '#ff2a2a' : model.avatarColor} 
                      status={status} 
                      mini
                      progress={response?.progress || 0}
                    />
                  </div>
                </CyberTooltip>
                
                <div className="flex flex-col min-w-0">
                  <span className={`text-xs font-bold font-mono truncate ${
                      isActive ? (isError ? 'text-red-400' : 'text-white') : 'text-gray-500'
                  }`}>
                    {model.name}
                  </span>
                  <span className={`text-[10px] font-mono truncate uppercase flex items-center gap-1 ${
                      isError ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {status}
                    {status === ModelStatus.STREAMING && (
                      <span className="block w-1 h-1 bg-cyber-neon rounded-full animate-ping" />
                    )}
                  </span>
                </div>
              </div>
              
              {/* Mini Terminal "TV" Effect */}
              <div className={`
                  relative w-full bg-black border-x border-b rounded-b-sm shadow-[inset_0_0_15px_rgba(0,0,0,1)] overflow-hidden
                  origin-top transition-all duration-500
                  ${hasData || isError ? 'animate-tv-on mt-3' : 'h-0 opacity-0 mt-0 scale-y-0'}
                  ${isError ? 'border-red-900/50' : 'border-cyber-gray/50'}
              `}
              style={{ height: (hasData || isError) ? '6rem' : '0' }}
              >
                  {/* Scanline Overlay */}
                  <div className="absolute inset-0 z-20 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%]"></div>
                  <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent ${isError ? 'via-red-500/5' : 'via-cyber-neon/5'} to-transparent animate-scanline z-20 pointer-events-none`}></div>
                  
                  {/* Terminal Text Content (Bottom Anchored for "Sliding Up" effect) */}
                  <div className="p-2 font-mono text-[9px] leading-3 h-full flex flex-col justify-end relative z-10">
                    <div className={`${isError ? 'text-red-400' : 'text-cyber-neon/80'} font-medium tracking-tight break-all whitespace-pre-wrap overflow-hidden`} style={{ maskImage: 'linear-gradient(to bottom, transparent, black 20%)' }}>
                      {isError && response?.error 
                          ? `>>> SYSTEM FAILURE <<<\nCode: ${status}\nDetails: ${response.error}`
                          : response?.text.slice(-350)
                      }
                      {status === ModelStatus.STREAMING && (
                        <span className="inline-block w-1.5 h-3 bg-cyber-neon align-middle animate-pulse ml-0.5 shadow-[0_0_5px_#00f3ff]"></span>
                      )}
                      {isCompleted && (
                         <span className="text-green-500 ml-1 animate-pulse">▮</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Glass Reflection */}
                  <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-white/5 to-transparent pointer-events-none z-30"></div>

                  {/* Completion/Error Flash */}
                  {isCompleted && (
                    <div className="absolute inset-0 bg-green-500/20 animate-pulse pointer-events-none z-0 mix-blend-overlay"></div>
                  )}
                  {isError && (
                    <div className="absolute inset-0 bg-red-500/10 animate-pulse-fast pointer-events-none z-0 mix-blend-overlay"></div>
                  )}
              </div>

              {/* Progress Bar for Streaming (Redundant but kept as secondary visual) */}
              {status === ModelStatus.STREAMING && (
                <div className="absolute bottom-0 left-0 h-[1px] bg-cyber-neon shadow-[0_0_5px_#00f3ff] transition-all duration-300 z-40" style={{ width: `${response.progress}%` }} />
              )}
              
              {/* Hover Glow */}
              {isActive && !isError && (
                <div className="absolute inset-0 bg-cyber-neon/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-0" />
              )}
              {isActive && isError && (
                <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-0" />
              )}
            </div>
          );
        })}
      </div>

      {selectedModelId && selectedModelConfig && selectedModelResponse && (
        <ModelDetailsModal 
            model={selectedModelConfig} 
            response={selectedModelResponse} 
            onClose={() => setSelectedModelId(null)} 
        />
      )}
    </>
  );
};

export default StatusMatrix;