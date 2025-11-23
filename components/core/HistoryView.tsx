import React from 'react';
import { Clock, MessageSquare, ChevronRight, Trash2 } from 'lucide-react';

interface HistoryItem {
    id: string;
    timestamp: number;
    prompt: string;
    consensus: string;
}

interface HistoryViewProps {
    isOpen: boolean;
    onClose: () => void;
    history: HistoryItem[];
    onSelect: (item: HistoryItem) => void;
    onClear: () => void;
}

export default function HistoryView({ isOpen, onClose, history, onSelect, onClear }: HistoryViewProps) {
    return (
        <div
            className={`fixed inset-y-0 right-0 z-50 w-80 bg-[#050505] border-l border-cyber-gray shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
        >
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="p-4 border-b border-cyber-gray flex items-center justify-between bg-black/50 backdrop-blur">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2 tracking-wider">
                        <Clock size={16} className="text-cyber-neon" />
                        TEMPORAL LOGS
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {history.length === 0 ? (
                        <div className="text-center text-gray-600 text-xs font-mono mt-10">
                            NO DATA RECORDED
                        </div>
                    ) : (
                        history.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onSelect(item)}
                                className="w-full text-left p-3 rounded-sm border border-transparent hover:border-cyber-gray hover:bg-white/5 transition-all group"
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[10px] font-mono text-gray-500">
                                        {new Date(item.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="text-xs text-white font-medium line-clamp-2 mb-1 group-hover:text-cyber-neon transition-colors">
                                    {item.prompt}
                                </div>
                                <div className="text-[10px] text-gray-400 line-clamp-1 flex items-center gap-1">
                                    <MessageSquare size={10} />
                                    {item.consensus ? "Consensus Reached" : "No Consensus"}
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-cyber-gray bg-black/50">
                    <button
                        onClick={onClear}
                        className="w-full py-2 flex items-center justify-center gap-2 text-xs font-mono text-cyber-red border border-cyber-red/30 hover:bg-cyber-red/10 transition-all rounded-sm"
                    >
                        <Trash2 size={14} /> PURGE LOGS
                    </button>
                </div>
            </div>
        </div>
    );
}
