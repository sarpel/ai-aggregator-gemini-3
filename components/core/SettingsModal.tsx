import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Server, Network, Cpu, Thermometer, Zap, List } from 'lucide-react';
import { SynthesizerConfig } from '../../types';
import CyberTooltip from '../ui/CyberTooltip';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: SynthesizerConfig;
    onUpdateConfig: (config: Partial<SynthesizerConfig>) => void;
}

export default function SettingsModal({ isOpen, onClose, config, onUpdateConfig }: SettingsModalProps) {
    if (!isOpen) return null;

    const [localConfig, setLocalConfig] = useState<SynthesizerConfig>(config);
    const [fetchedModels, setFetchedModels] = useState<string[]>([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleSave = () => {
        onUpdateConfig(localConfig);
        onClose();
    };

    const fetchModels = async () => {
        if (!localConfig.customEndpoint) {
            setFetchError("Endpoint URL is required");
            return;
        }

        setIsFetchingModels(true);
        setFetchError(null);

        try {
            // Use our backend proxy to avoid CORS
            const params = new URLSearchParams({
                endpoint: localConfig.customEndpoint,
                provider: localConfig.provider,
                apiStyle: localConfig.customApiStyle || 'OPENAI'
            });

            if (localConfig.customApiKey) {
                params.append('apiKey', localConfig.customApiKey);
            }

            const response = await fetch(`http://localhost:3002/api/proxy/models?${params.toString()}`);

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to fetch models');
            }

            const data = await response.json();

            // Parse models based on typical formats
            let models: string[] = [];
            if (Array.isArray(data.data)) {
                // OpenAI format: { data: [{ id: 'model-name' }, ...] }
                models = data.data.map((m: any) => m.id);
            } else if (Array.isArray(data)) {
                // Simple array
                models = data.map((m: any) => typeof m === 'string' ? m : m.id);
            } else {
                // Fallback or other formats
                console.warn('Unknown model list format', data);
                setFetchError("Unknown response format from provider");
            }

            if (models.length > 0) {
                setFetchedModels(models);
            } else {
                setFetchError("No models found");
            }

        } catch (err: any) {
            setFetchError(err.message);
        } finally {
            setIsFetchingModels(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-3xl bg-[#0a0a0a] border border-cyber-gray rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-cyber-gray/50">
                    <h2 className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
                        <span className="text-cyber-neon">SYSTEM</span> CONFIGURATION
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                    {/* Section: Synthesis Provider */}
                    <section>
                        <h3 className="text-sm font-mono text-cyber-neon mb-4 uppercase tracking-widest border-b border-cyber-gray/30 pb-2 flex items-center gap-2">
                            <Cpu size={14} /> Consensus Engine
                        </h3>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-mono text-gray-400 mb-2">SYNTHESIZER MODEL</label>
                                <select
                                    value={localConfig.provider}
                                    onChange={(e) => setLocalConfig({ ...localConfig, provider: e.target.value as any })}
                                    className="w-full bg-black border border-cyber-gray text-white p-2 text-sm focus:border-cyber-neon focus:outline-none"
                                >
                                    <option value="GEMINI">Gemini 2.5 Flash (Default)</option>
                                    <option value="CUSTOM">Custom / Local LLM</option>
                                </select>
                            </div>

                            {localConfig.provider === 'CUSTOM' && (
                                <div className="p-4 bg-cyber-gray/10 rounded border border-cyber-gray/30 space-y-4 animate-fadeIn">

                                    {/* API Style */}
                                    <div>
                                        <label className="block text-xs font-mono text-gray-400 mb-2 flex items-center gap-2">
                                            <Network size={12} /> API PROTOCOL
                                        </label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="apiStyle"
                                                    checked={localConfig.customApiStyle === 'OPENAI' || !localConfig.customApiStyle}
                                                    onChange={() => setLocalConfig({ ...localConfig, customApiStyle: 'OPENAI' })}
                                                    className="accent-cyber-neon"
                                                />
                                                <span className="text-sm text-gray-300">OpenAI Compatible</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="apiStyle"
                                                    checked={localConfig.customApiStyle === 'ANTHROPIC'}
                                                    onChange={() => setLocalConfig({ ...localConfig, customApiStyle: 'ANTHROPIC' })}
                                                    className="accent-cyber-neon"
                                                />
                                                <span className="text-sm text-gray-300">Anthropic</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Endpoint & Key */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-mono text-gray-400 mb-2">ENDPOINT URL</label>
                                            <div className="flex items-center bg-black border border-cyber-gray focus-within:border-cyber-neon transition-colors">
                                                <Server size={14} className="ml-2 text-gray-500" />
                                                <input
                                                    type="text"
                                                    value={localConfig.customEndpoint || ''}
                                                    onChange={(e) => setLocalConfig({ ...localConfig, customEndpoint: e.target.value })}
                                                    placeholder={localConfig.customApiStyle === 'ANTHROPIC' ? "https://api.anthropic.com/v1/messages" : "http://localhost:11434/v1/chat/completions"}
                                                    className="w-full bg-transparent text-white p-2 text-sm focus:outline-none font-mono"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-mono text-gray-400 mb-2">API KEY (OPTIONAL)</label>
                                            <input
                                                type="password"
                                                value={localConfig.customApiKey || ''}
                                                onChange={(e) => setLocalConfig({ ...localConfig, customApiKey: e.target.value })}
                                                placeholder="sk-..."
                                                className="w-full bg-black border border-cyber-gray text-white p-2 text-sm focus:border-cyber-neon focus:outline-none font-mono"
                                            />
                                        </div>
                                    </div>

                                    {/* Model Selection */}
                                    <div>
                                        <label className="block text-xs font-mono text-gray-400 mb-2">MODEL NAME</label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    value={localConfig.customModelName || ''}
                                                    onChange={(e) => setLocalConfig({ ...localConfig, customModelName: e.target.value })}
                                                    placeholder={localConfig.customApiStyle === 'ANTHROPIC' ? "claude-3-sonnet-20240229" : "llama3"}
                                                    className="w-full bg-black border border-cyber-gray text-white p-2 text-sm focus:border-cyber-neon focus:outline-none font-mono"
                                                    list="fetched-models"
                                                />
                                                <datalist id="fetched-models">
                                                    {fetchedModels.map(m => <option key={m} value={m} />)}
                                                </datalist>
                                            </div>
                                            <button
                                                onClick={fetchModels}
                                                disabled={isFetchingModels || !localConfig.customEndpoint}
                                                className="px-3 py-2 bg-cyber-gray/20 border border-cyber-gray text-cyber-neon hover:bg-cyber-neon/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                title="Fetch available models from endpoint"
                                            >
                                                {isFetchingModels ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <List size={16} />}
                                                FETCH
                                            </button>
                                        </div>
                                        {fetchError && <p className="text-red-400 text-xs mt-1 font-mono">{fetchError}</p>}
                                        {fetchedModels.length > 0 && <p className="text-green-400 text-xs mt-1 font-mono">{fetchedModels.length} models found</p>}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-mono text-gray-400 mb-2">SYSTEM INSTRUCTION</label>
                                <textarea
                                    value={localConfig.systemInstruction}
                                    onChange={(e) => setLocalConfig({ ...localConfig, systemInstruction: e.target.value })}
                                    className="w-full bg-black border border-cyber-gray text-white p-2 text-sm h-32 focus:border-cyber-neon focus:outline-none resize-none font-mono text-xs"
                                    placeholder="You are the arbiter of truth..."
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section: Advanced Parameters */}
                    <section>
                        <h3 className="text-sm font-mono text-cyber-neon mb-4 uppercase tracking-widest border-b border-cyber-gray/30 pb-2 flex items-center gap-2">
                            <Zap size={14} /> Advanced Parameters
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Temperature */}
                            <div>
                                <label className="block text-xs font-mono text-gray-400 mb-2 flex items-center gap-2">
                                    <Thermometer size={12} /> TEMPERATURE: {localConfig.temperature ?? 0.7}
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={localConfig.temperature ?? 0.7}
                                    onChange={(e) => setLocalConfig({ ...localConfig, temperature: parseFloat(e.target.value) })}
                                    className="w-full accent-cyber-neon h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-gray-600 font-mono mt-1">
                                    <span>PRECISE</span>
                                    <span>CREATIVE</span>
                                </div>
                            </div>

                            {/* Max Tokens */}
                            <div>
                                <label className="block text-xs font-mono text-gray-400 mb-2">MAX OUTPUT TOKENS</label>
                                <input
                                    type="number"
                                    value={localConfig.maxOutputTokens || ''}
                                    onChange={(e) => setLocalConfig({ ...localConfig, maxOutputTokens: parseInt(e.target.value) || undefined })}
                                    placeholder="Default"
                                    className="w-full bg-black border border-cyber-gray text-white p-2 text-sm focus:border-cyber-neon focus:outline-none font-mono"
                                />
                            </div>

                            {/* Reasoning Effort */}
                            <div>
                                <label className="block text-xs font-mono text-gray-400 mb-2">REASONING EFFORT</label>
                                <select
                                    value={localConfig.reasoningEffort || 'medium'}
                                    onChange={(e) => setLocalConfig({ ...localConfig, reasoningEffort: e.target.value as any })}
                                    className="w-full bg-black border border-cyber-gray text-white p-2 text-sm focus:border-cyber-neon focus:outline-none"
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                        </div>
                    </section>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-cyber-gray/50 flex justify-end gap-4 bg-black/50">
                    <button
                        onClick={() => setLocalConfig(config)}
                        className="px-4 py-2 text-xs font-mono text-gray-500 hover:text-white transition-colors flex items-center gap-2"
                    >
                        <RotateCcw size={14} /> RESET
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-cyber-neon/10 border border-cyber-neon/50 text-cyber-neon hover:bg-cyber-neon hover:text-black transition-all font-bold text-sm tracking-widest flex items-center gap-2 shadow-[0_0_15px_rgba(0,243,255,0.1)] hover:shadow-[0_0_25px_rgba(0,243,255,0.3)]"
                    >
                        <Save size={16} /> SAVE CONFIGURATION
                    </button>
                </div>

            </div>
        </div>
    );
}
