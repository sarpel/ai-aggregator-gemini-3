import React from 'react';
import { ModelProvider, AppState, ModelStatus } from '../../types';
import { AVAILABLE_MODELS } from '../../constants';
import ModelAvatar from '../ui/ModelAvatar';

interface StatusMatrixProps {
  activeModels: ModelProvider[];
  modelResponses: Record<ModelProvider, any>;
}

const StatusMatrix: React.FC<StatusMatrixProps> = ({ activeModels, modelResponses }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {AVAILABLE_MODELS.map((model) => {
        const isActive = activeModels.includes(model.id);
        const response = modelResponses[model.id];
        const status = isActive ? response?.status || ModelStatus.IDLE : ModelStatus.IDLE;
        
        return (
          <div 
            key={model.id}
            className={`relative p-3 border ${
              isActive 
                ? 'border-cyber-gray bg-cyber-gray/20' 
                : 'border-transparent opacity-30 grayscale'
            } rounded-sm transition-all duration-300 overflow-hidden group`}
          >
            <div className="flex items-center gap-3">
              <ModelAvatar 
                name={model.name} 
                color={model.avatarColor} 
                status={status} 
                mini
              />
              <div className="flex flex-col min-w-0">
                <span className={`text-xs font-bold font-mono truncate ${isActive ? 'text-white' : 'text-gray-500'}`}>
                  {model.name}
                </span>
                <span className="text-[10px] text-gray-400 font-mono truncate uppercase">
                  {status}
                </span>
              </div>
            </div>
            
            {/* Progress Bar for Streaming */}
            {status === ModelStatus.STREAMING && (
              <div className="absolute bottom-0 left-0 h-1 bg-cyber-neon transition-all duration-300" style={{ width: `${response.progress}%` }} />
            )}
            
            {/* Matrix Rain Effect on Active Hover (Simulated with CSS) */}
            {isActive && (
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-cyber-neon/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StatusMatrix;
