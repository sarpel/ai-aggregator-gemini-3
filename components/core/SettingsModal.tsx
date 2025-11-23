import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import { AVAILABLE_MODELS } from '../../constants';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: any; // Synthesizer config
    onUpdateConfig: (config: any) => void;
}

export default function SettingsModal({ isOpen, onClose, config, onUpdateConfig }: SettingsModalProps) {
    if (!isOpen) return null;

    const [localConfig, setLocalConfig] = useState(config);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleSave = () => {
        onUpdateConfig(localConfig);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-[#0a0a0a] border border-cyber-gray rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh]">

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
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Section: Synthesis */}
                    <section>
                        <h3 className="text-sm font-mono text-cyber-neon mb-4 uppercase tracking-widest border-b border-cyber-gray/30 pb-2">
                            Consensus Engine
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-mono text-gray-400 mb-2">SYNTHESIZER MODEL</label>
                                <select
                                    value={localConfig.provider}
                                    onChange={(e) => setLocalConfig({ ...localConfig, provider: e.target.value })}
                                    className="w-full bg-black border border-cyber-gray text-white p-2 text-sm focus:border-cyber-neon focus:outline-none"
                                >
                                    <option value="GEMINI">Gemini 2.5 Flash (Default)</option>
                                    <option value="CUSTOM">Custom / Local LLM</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-mono text-gray-400 mb-2">SYSTEM INSTRUCTION</label>
                                <textarea
                                    value={localConfig.systemInstruction}
                                    onChange={(e) => setLocalConfig({ ...localConfig, systemInstruction: e.target.value })}
                                    className="w-full bg-black border border-cyber-gray text-white p-2 text-sm h-32 focus:border-cyber-neon focus:outline-none resize-none"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section: Connection Info */}
                    <section>
                        <h3 className="text-sm font-mono text-cyber-neon mb-4 uppercase tracking-widest border-b border-cyber-gray/30 pb-2">
                            Network Uplink
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-4 rounded-sm border border-white/10">
                                <div className="text-xs text-gray-500 mb-1">BACKEND STATUS</div>
                                <div className="text-green-400 font-mono text-sm flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    ONLINE
                                </div>
                            </div>
                            <div className="bg-white/5 p-4 rounded-sm border border-white/10">
                                <div className="text-xs text-gray-500 mb-1">API MODE</div>
                                <div className="text-cyber-neon font-mono text-sm">
                                    SECURE PROXY
                                </div>
                            </div>
                        </div>
                    </section>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-cyber-gray/50 flex justify-end gap-4">
                    <button
                        onClick={() => setLocalConfig(config)}
                        className="px-4 py-2 text-xs font-mono text-gray-500 hover:text-white transition-colors flex items-center gap-2"
                    >
                        <RotateCcw size={14} /> RESET
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-cyber-neon/10 border border-cyber-neon/50 text-cyber-neon hover:bg-cyber-neon hover:text-black transition-all font-bold text-sm tracking-widest flex items-center gap-2"
                    >
                        <Save size={16} /> SAVE CHANGES
                    </button>
                </div>

            </div>
        </div>
    );
}
