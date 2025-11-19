
import React, { useState, useEffect, useRef } from 'react';
import { ModelProvider, ModelResponse, ConsensusResult, ModelStatus, AppAction, SynthesizerConfig } from '../../types';
import { AVAILABLE_MODELS } from '../../constants';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, Terminal, Layers, Cpu, Settings } from 'lucide-react';
import SynthesizerSettings from './SynthesizerSettings';

interface ResponseViewerProps {
  responses: Record<ModelProvider, ModelResponse>;
  consensus: ConsensusResult;
  activeModels: ModelProvider[];
  synthesizerConfig: SynthesizerConfig;
  dispatch: React.Dispatch<AppAction>;
}

const ResponseViewer: React.FC<ResponseViewerProps> = ({ responses, consensus, activeModels, synthesizerConfig, dispatch }) => {
  const [selectedTab, setSelectedTab] = useState<'CONSENSUS' | ModelProvider>('CONSENSUS');
  const [copiedState, setCopiedState] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const activeModelList = AVAILABLE_MODELS.filter(m => activeModels.includes(m.id));

  // Auto-scroll effect
  useEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      // Smooth scroll to bottom
      scrollContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'smooth'
      });
    }
  }, [
    // Trigger scroll when the text of the currently viewed tab changes
    selectedTab,
    selectedTab === 'CONSENSUS' ? consensus.text : responses[selectedTab as ModelProvider]?.text
  ]);

  const handleCopy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedState(selectedTab);
      setTimeout(() => setCopiedState(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const renderContent = (content: string, isCode: boolean = false) => {
    if (!content) return <div className="text-gray-600 italic font-mono">Initialized. Awaiting data stream...</div>;
    
    return (
      <div className="prose prose-invert max-w-none prose-p:text-sm prose-pre:bg-black prose-pre:border prose-pre:border-cyber-gray">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  };

  const textToCopy = selectedTab === 'CONSENSUS' ? consensus.text : responses[selectedTab as ModelProvider]?.text;
  const isCopySuccess = copiedState === selectedTab;

  return (
    <>
      <div className="flex flex-col h-full border border-cyber-gray bg-black/50 backdrop-blur-sm rounded-sm shadow-2xl overflow-hidden relative group">
        {/* Tabs Header */}
        <div className="flex overflow-x-auto border-b border-cyber-gray bg-black/80 no-scrollbar pr-16">
          <button
            onClick={() => setSelectedTab('CONSENSUS')}
            className={`flex items-center gap-2 px-4 py-3 font-mono text-xs font-bold uppercase transition-colors whitespace-nowrap border-r border-cyber-gray ${
              selectedTab === 'CONSENSUS' 
                ? 'bg-cyber-neon/10 text-cyber-neon border-b-2 border-b-cyber-neon' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Layers size={14} />
            Consensus
          </button>
          
          {activeModelList.map(model => {
             const resp = responses[model.id];
             const isStreaming = resp?.status === ModelStatus.STREAMING;
             return (
              <button
                key={model.id}
                onClick={() => setSelectedTab(model.id)}
                className={`flex items-center gap-2 px-4 py-3 font-mono text-xs font-bold uppercase transition-colors whitespace-nowrap border-r border-cyber-gray relative ${
                  selectedTab === model.id 
                    ? 'bg-cyber-gray/30 text-white border-b-2' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                style={{ borderBottomColor: selectedTab === model.id ? model.avatarColor : 'transparent' }}
              >
                <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-cyber-neon animate-pulse' : 'bg-gray-600'}`} style={{ backgroundColor: isStreaming ? undefined : model.avatarColor }}></span>
                {model.name}
              </button>
             );
          })}
        </div>

        {/* Floating Copy Button (Top Right) */}
        <div className="absolute top-2 right-2 z-30">
          <button 
            onClick={() => handleCopy(textToCopy)}
            disabled={!textToCopy}
            className={`
              flex items-center justify-center w-8 h-8 rounded border transition-all duration-300
              ${isCopySuccess 
                  ? 'bg-green-500/20 border-green-500 text-green-500' 
                  : 'bg-black/80 border-cyber-gray text-gray-400 hover:border-cyber-neon hover:text-cyber-neon hover:shadow-[0_0_10px_rgba(0,243,255,0.2)]'
              }
            `}
            title="Copy to Clipboard"
          >
            <div className={`transition-all duration-300 transform ${isCopySuccess ? 'scale-100' : 'scale-100'}`}>
               {isCopySuccess ? <Check size={16} /> : <Copy size={14} />}
            </div>
          </button>
        </div>

        {/* Content Area */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] relative scroll-smooth"
        >
          {selectedTab === 'CONSENSUS' ? (
            <div className="animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-cyber-neon font-mono text-lg tracking-widest flex items-center gap-2">
                    <Layers className="text-cyber-pink" />
                    NEURAL SYNTHESIS
                  </h3>
                  <button 
                    onClick={() => setShowSettings(true)}
                    className="p-1.5 text-gray-500 hover:text-cyber-neon hover:bg-cyber-neon/10 rounded border border-transparent hover:border-cyber-neon transition-all"
                    title="Configure Neural Core"
                  >
                    <Settings size={14} />
                  </button>
                </div>
                
                {consensus.text && (
                  <span className="text-xs font-mono text-cyber-yellow bg-cyber-yellow/10 px-2 py-1 rounded border border-cyber-yellow/30">
                    CONFIDENCE: {(consensus.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="bg-black/60 border border-cyber-neon/30 p-6 rounded shadow-[0_0_30px_rgba(0,243,255,0.05)] min-h-[200px]">
                {consensus.text ? renderContent(consensus.text) : (
                  <div className="flex flex-col items-center justify-center h-32 opacity-50">
                    <Cpu className="animate-pulse text-cyber-gray mb-2" size={48} />
                    <span className="font-mono text-xs tracking-widest text-gray-500">AWAITING INPUT STREAMS...</span>
                  </div>
                )}
              </div>
              
              {/* Contributors Graph (Simple Text Bar) */}
              {consensus.contributors.length > 0 && (
                 <div className="mt-6">
                   <h4 className="text-xs font-mono text-gray-500 uppercase mb-2">Contribution Vectors</h4>
                   <div className="flex h-2 rounded-full overflow-hidden bg-gray-800">
                      {consensus.contributors.map((c, idx) => {
                        const model = AVAILABLE_MODELS.find(m => m.id === c.provider);
                        return (
                          <div 
                            key={c.provider} 
                            style={{ width: `${c.weight * 100}%`, backgroundColor: model?.avatarColor || '#555' }}
                            title={`${model?.name}: ${(c.weight * 100).toFixed(0)}%`}
                          />
                        );
                      })}
                   </div>
                 </div>
              )}
            </div>
          ) : (
            <div className="animate-fadeIn">
               {(() => {
                 const model = AVAILABLE_MODELS.find(m => m.id === selectedTab);
                 const resp = responses[selectedTab as ModelProvider];
                 
                 if (!model || !resp) return null;

                 return (
                   <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 flex items-center justify-center bg-black border border-cyber-gray rounded">
                           <Terminal size={16} style={{ color: model.avatarColor }} />
                         </div>
                         <div>
                           <h3 className="font-bold text-white">{model.name}</h3>
                           <p className="text-xs font-mono text-gray-400">
                             STATUS: <span className={resp.status === ModelStatus.ERROR || resp.status === ModelStatus.TIMEOUT ? 'text-red-500' : 'text-green-500'}>{resp.status}</span>
                             {resp.latency > 0 && ` | ${resp.latency}ms`}
                           </p>
                         </div>
                      </div>
                    </div>
                    
                    <div className={`p-4 rounded border border-gray-800 bg-black/40 min-h-[200px] ${resp.status === ModelStatus.STREAMING ? 'border-b-cyber-neon/50' : ''}`}>
                      {resp.error ? (
                        <div className="text-red-400 font-mono flex items-center gap-2">
                          <span className="text-xl">⚠</span> {resp.error}
                        </div>
                      ) : (
                        renderContent(resp.text)
                      )}
                      {resp.status === ModelStatus.STREAMING && (
                        <span className="inline-block w-2 h-4 ml-1 bg-cyber-neon animate-pulse align-middle" />
                      )}
                    </div>
                   </>
                 );
               })()}
            </div>
          )}
        </div>
      </div>
      {showSettings && (
        <SynthesizerSettings 
          config={synthesizerConfig} 
          dispatch={dispatch} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </>
  );
};

export default ResponseViewer;
