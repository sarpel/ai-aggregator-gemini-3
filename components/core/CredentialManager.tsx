import React, { useState } from 'react';
import { ModelProvider, AppAction } from '../../types';
import { AVAILABLE_MODELS } from '../../constants';
import { Shield, Key, XCircle, Eye, EyeOff } from 'lucide-react';

interface CredentialManagerProps {
  apiKeyMap: Record<ModelProvider, string>;
  dispatch: React.Dispatch<AppAction>;
}

const CredentialManager: React.FC<CredentialManagerProps> = ({ apiKeyMap, dispatch }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-black/80 border border-cyber-gray text-xs font-mono text-cyber-neon hover:border-cyber-neon backdrop-blur hover:shadow-[0_0_10px_rgba(0,243,255,0.2)] transition-all rounded-sm"
      >
        <Shield size={14} />
        SECURE VAULT
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-cyber-gray shadow-2xl rounded-sm p-6 relative">
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <XCircle size={20} />
        </button>

        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
          <Shield className="text-cyber-neon" /> CREDENTIAL VAULT
        </h2>
        <p className="text-xs text-gray-400 mb-6 font-mono">
          Keys are stored in RAM only. Cleared on refresh.
        </p>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {AVAILABLE_MODELS.map(model => (
            <div key={model.id} className="space-y-1">
              <label className="text-xs font-bold text-gray-300 uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: model.avatarColor }}></span>
                {model.name}
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                <input 
                  type={showKeys ? "text" : "password"}
                  value={apiKeyMap[model.id] || ''}
                  onChange={(e) => dispatch({ 
                    type: 'SET_API_KEY', 
                    payload: { provider: model.id, key: e.target.value } 
                  })}
                  placeholder={model.id === ModelProvider.GEMINI ? "Required for Gemini" : "Optional (Uses Sim)"}
                  className="w-full bg-black border border-gray-800 rounded px-10 py-2 text-sm font-mono text-cyber-neon focus:border-cyber-neon focus:outline-none transition-colors placeholder-gray-700"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-between items-center border-t border-gray-800 pt-4">
          <button 
            onClick={() => setShowKeys(!showKeys)}
            className="text-xs text-gray-500 hover:text-white flex items-center gap-1"
          >
            {showKeys ? <EyeOff size={14} /> : <Eye size={14} />} {showKeys ? 'Hide' : 'Show'} Secrets
          </button>
          <button 
            onClick={() => dispatch({ type: 'RESET_SESSION' })}
            className="text-xs text-cyber-red hover:underline font-mono"
          >
            PURGE MEMORY
          </button>
        </div>
      </div>
    </div>
  );
};

export default CredentialManager;
