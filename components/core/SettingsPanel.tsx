import { useCallback, useEffect, useState, type Dispatch, type FC } from 'react';
import { normalizeModelConfigs } from '../../constants';
import type { AppAction, ModelConfig } from '../../types';
import { Settings, X, Eye, EyeOff, Trash2, Plus, Save, Server, Network, Key } from 'lucide-react';
import CyberButton from '../ui/CyberButton';
import CyberTooltip from '../ui/CyberTooltip';

interface SettingsPanelProps {
  dispatch: Dispatch<AppAction>;
  onClose: () => void;
}

const SettingsPanel: FC<SettingsPanelProps> = ({ dispatch, onClose }) => {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [originalModels, setOriginalModels] = useState<ModelConfig[]>([]);
  const [keyStatuses, setKeyStatuses] = useState<Record<string, boolean>>({});
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadModels = useCallback(async (): Promise<ModelConfig[]> => {
    setLoading(true);

    try {
      const res = await fetch('/api/models');
      if (!res.ok) {
        throw new Error(`Failed to load model configs: ${res.status}`);
      }

      const payload = await res.json() as ModelConfig[] | { models?: ModelConfig[] };
      const nextModels = normalizeModelConfigs(Array.isArray(payload) ? payload : payload.models ?? []);

      setModels(nextModels);
      setOriginalModels(nextModels);

      const statusEntries = await Promise.all(nextModels.map(async (model) => {
        try {
          const statusRes = await fetch(`/api/models/${model.id}/key/status`);
          if (!statusRes.ok) {
            return [model.id, false] as const;
          }

          const statusData = await statusRes.json() as { hasKey?: boolean };
          return [model.id, statusData.hasKey === true] as const;
        } catch (error) {
          console.error(`Failed to fetch key status for ${model.id}`, error);
          return [model.id, false] as const;
        }
      }));

      setKeyStatuses(Object.fromEntries(statusEntries));
      return nextModels;
    } catch (error) {
      console.error('Failed to fetch models', error);
      setModels([]);
      setOriginalModels([]);
      setKeyStatuses({});
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  const handleModelChange = (id: string, field: keyof ModelConfig, value: ModelConfig[keyof ModelConfig]) => {
    setModels((prev) => prev.map((model) => {
      if (model.id !== id) {
        return model;
      }

      if (field === 'modelName' && typeof value === 'string') {
        const nextModelName = value.trim();

        return {
          ...model,
          modelName: value,
          name: nextModelName.length > 0 ? nextModelName : model.name,
        };
      }

      return { ...model, [field]: value } as ModelConfig;
    }));
  };

  const handleKeyChange = (id: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [id]: value }));
  };

  const toggleShowKey = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddCustomModel = () => {
    const newId = crypto.randomUUID();
    const newModel: ModelConfig = {
      id: newId,
      name: 'New Custom Model',
      provider: 'CUSTOM',
      apiStyle: 'OPENAI',
      modelName: '',
      endpoint: '',
      isCustom: true,
      isSimulated: false,
      avatarColor: '#00f3ff',
      description: 'Custom Model'
    };
    setModels(prev => [...prev, newModel]);
  };

  const handleDeleteCustomModel = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this model? This action cannot be undone.')) {
      return;
    }
    const isNew = !originalModels.find(m => m.id === id);
    if (!isNew) {
      try {
        const deleteResponse = await fetch(`/api/models/${id}`, { method: 'DELETE' });
        if (!deleteResponse.ok) {
          const body = await deleteResponse.text().catch(() => '');
          console.error(`Failed to delete model (status ${deleteResponse.status}):`, body);
          return;
        }
      } catch (e) {
        console.error('Failed to delete model', e);
        return;
      }
    }
    setModels(prev => prev.filter(m => m.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const tasks = models.map(async (model) => {
        const isNew = !originalModels.find(m => m.id === model.id);
        const pendingApiKey = apiKeys[model.id]?.trim();

        if (isNew) {
          const createResponse = await fetch('/api/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: model.name,
              endpoint: model.endpoint,
              modelName: model.modelName,
              apiStyle: model.apiStyle,
              avatarColor: model.avatarColor,
              description: model.description,
              ...(pendingApiKey ? { apiKey: pendingApiKey } : {}),
            })
          });

          if (!createResponse.ok) {
            throw new Error(`Failed to create model "${model.name}" (${model.id}): ${createResponse.status}`);
          }
        } else {
          const original = originalModels.find(m => m.id === model.id);
          const hasConfigChanges = Boolean(
            original && (
              original.endpoint !== model.endpoint ||
              original.modelName !== model.modelName ||
              original.apiStyle !== model.apiStyle ||
              original.name !== model.name ||
              original.avatarColor !== model.avatarColor ||
              original.description !== model.description
            )
          );

          if (hasConfigChanges || pendingApiKey) {
            const updateResponse = await fetch(`/api/models/${model.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: model.name,
                endpoint: model.endpoint,
                modelName: model.modelName,
                apiStyle: model.apiStyle,
                avatarColor: model.avatarColor,
                description: model.description,
                ...(pendingApiKey ? { apiKey: pendingApiKey } : {}),
              })
            });

            if (!updateResponse.ok) {
              throw new Error(`Failed to update model "${model.name}" (${model.id}): ${updateResponse.status}`);
            }
          }
        }
      });

      const results = await Promise.allSettled(tasks);
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failures.length > 0) {
        failures.forEach(f => console.error('Save error:', f.reason));
        setSaveError(`${failures.length} model(s) failed to save. Check the console for details.`);
        setSaving(false);
        return;
      }

      const refreshedModels = await loadModels();
      dispatch({ type: 'SET_MODEL_CONFIGS', configs: refreshedModels });
      onClose();
    } catch (error) {
      console.error('Failed to save configuration', error);
      setSaveError('An unexpected error occurred while saving. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderModelCard = (model: ModelConfig) => {
    const hasKey = keyStatuses[model.id] || !!apiKeys[model.id];

    return (
      <div key={model.id} className="border border-cyan-500/20 hover:border-cyan-400/40 rounded-sm p-4 space-y-4 bg-cyber-gray/10 relative">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: model.avatarColor }}></span>
            <input
              type="text"
              value={model.name}
              onChange={(e) => handleModelChange(model.id, 'name', e.target.value)}
              aria-label="Model name"
              className="bg-black border border-gray-700 text-white font-mono text-xs p-1 outline-none focus:border-cyber-neon focus:shadow-[0_0_10px_rgba(0,255,255,0.3)]"
            />
          </div>
          <div className="flex items-center gap-3">
            <CyberTooltip content={hasKey ? "API Key Configured" : "API Key Missing"} position="left">
              <div className={`w-2 h-2 rounded-full ${hasKey ? 'bg-green-400' : 'bg-red-500'}`}></div>
            </CyberTooltip>
            <span className="sr-only">{hasKey ? "API Key configured" : "API Key missing"}</span>
            {model.isCustom && (
              <button type="button" onClick={() => handleDeleteCustomModel(model.id)} aria-label="Delete model" className="text-gray-500 hover:text-cyber-red transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <Network size={12} /> API Style / Protocol
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`apiStyle-${model.id}`}
                  checked={model.apiStyle === 'OPENAI'}
                  onChange={() => handleModelChange(model.id, 'apiStyle', 'OPENAI')}
                  aria-label="OpenAI Compatible"
                  className="accent-cyber-pink"
                />
                <span className="text-sm font-mono text-gray-300">OpenAI Compatible</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`apiStyle-${model.id}`}
                  checked={model.apiStyle === 'ANTHROPIC'}
                  onChange={() => handleModelChange(model.id, 'apiStyle', 'ANTHROPIC')}
                  aria-label="Anthropic"
                  className="accent-cyber-pink"
                />
                <span className="text-sm font-mono text-gray-300">Anthropic</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`apiStyle-${model.id}`}
                  checked={model.apiStyle === 'GEMINI'}
                  onChange={() => handleModelChange(model.id, 'apiStyle', 'GEMINI')}
                  aria-label="Gemini"
                  className="accent-cyber-pink"
                />
                <span className="text-sm font-mono text-gray-300">Gemini</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-gray-500">Endpoint URL</div>
            <div className="flex items-center bg-black border border-gray-700 focus-within:border-cyber-neon focus-within:shadow-[0_0_10px_rgba(0,255,255,0.3)]">
              <Server size={14} className="mx-2 text-gray-500" />
              <input
                type="text"
                value={model.endpoint || ''}
                onChange={(e) => handleModelChange(model.id, 'endpoint', e.target.value)}
                placeholder="https://api..."
                aria-label="Endpoint URL"
                className="w-full bg-transparent text-white font-mono text-xs p-2 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-gray-500">Model ID / Display Name</div>
            <input
              type="text"
              value={model.modelName || ''}
              onChange={(e) => handleModelChange(model.id, 'modelName', e.target.value)}
              placeholder="model-name"
              aria-label="Model ID / Display Name"
              className="w-full bg-black border border-gray-700 text-white font-mono text-xs p-2 outline-none focus:border-cyber-neon focus:shadow-[0_0_10px_rgba(0,255,255,0.3)]"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="text-xs text-gray-500">API Key</div>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
              <input
                type={showKeys[model.id] ? "text" : "password"}
                value={apiKeys[model.id] || ''}
                onChange={(e) => handleKeyChange(model.id, e.target.value)}
                placeholder={keyStatuses[model.id] ? "Stored securely — enter new key to replace" : "Enter API Key"}
                aria-label="API Key"
                className="w-full bg-black border border-gray-700 text-white font-mono text-xs py-2 pl-10 pr-10 outline-none focus:border-cyber-neon focus:shadow-[0_0_10px_rgba(0,255,255,0.3)]"
              />
              <button
                type="button"
                onClick={() => toggleShowKey(model.id)}
                aria-label={showKeys[model.id] ? "Hide API key" : "Show API key"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                {showKeys[model.id] ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const defaultModels = models.filter(m => !m.isCustom);
  const customModels = models.filter(m => m.isCustom);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="w-full max-w-3xl bg-cyber-black border border-cyber-neon shadow-[0_0_50px_rgba(0,243,255,0.1)] rounded-sm relative flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-cyber-gray/20 border-b border-cyber-neon/30 p-6 flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-black tracking-tighter text-white flex items-center gap-3">
            <Settings className="text-cyber-neon animate-pulse" />
            NEURAL CONFIGURATION
          </h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-cyber-red transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar flex-1 space-y-8">
          {loading ? (
            <div className="flex justify-center items-center h-32 text-cyber-neon font-mono">
              <span className="animate-pulse">LOADING NEURAL PATHWAYS...</span>
            </div>
          ) : (
            <>
              {/* Default Providers */}
              <div className="space-y-4">
                <h3 className="text-xs uppercase tracking-wider text-cyan-600 font-bold border-b border-cyan-900/50 pb-2">
                  Default Providers
                </h3>
                <div className="space-y-4">
                  {defaultModels.map(renderModelCard)}
                </div>
              </div>

              {/* Custom Models */}
              <div className="space-y-4">
                <h3 className="text-xs uppercase tracking-wider text-cyan-600 font-bold border-b border-cyan-900/50 pb-2">
                  Custom Models
                </h3>
                <div className="space-y-4">
                  {customModels.map(renderModelCard)}

                  <CyberButton
                    onClick={handleAddCustomModel}
                    variant="secondary"
                    className="w-full flex justify-center items-center gap-2"
                  >
                    <Plus size={16} />
                    ADD CUSTOM MODEL
                  </CyberButton>
                </div>
              </div>

              {models.length === 0 && (
                <div className="border border-cyan-500/20 rounded-sm p-6 text-center bg-cyber-gray/10 space-y-3">
                  <p className="text-sm font-mono text-gray-300">No model configs are loaded yet.</p>
                  <p className="text-xs font-mono text-gray-500">Use the button below to add your first LLM config entry point.</p>
                  <div className="flex justify-center">
                    <CyberButton onClick={handleAddCustomModel} variant="secondary" className="flex items-center gap-2">
                      <Plus size={16} />
                      ADD CUSTOM MODEL
                    </CyberButton>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-cyber-gray/50 flex flex-col gap-3 shrink-0 bg-cyber-black">
          {saveError && (
            <p className="text-xs font-mono text-red-400 text-right">{saveError}</p>
          )}
          <div className="flex justify-end">
            <CyberButton onClick={handleSave} variant="primary" loading={saving}>
              <Save size={16} className="mr-2" />
              SAVE CONFIGURATION
            </CyberButton>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsPanel;
