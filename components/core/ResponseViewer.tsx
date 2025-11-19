import React, { useState } from 'react';
import { ModelProvider, ModelResponse, ConsensusResult, ModelStatus } from '../../types';
import { AVAILABLE_MODELS } from '../../constants';
import ReactMarkdown from 'react-markdown';
import { Copy, Terminal, Layers } from 'lucide-react';

interface ResponseViewerProps {
  responses: Record<ModelProvider, ModelResponse>;
  consensus: ConsensusResult;
  activeModels: ModelProvider[];
}

const ResponseViewer: React.FC<ResponseViewerProps> = ({ responses, consensus, activeModels }) => {
  const [selectedTab, setSelectedTab] = useState<'CONSENSUS' | ModelProvider>('CONSENSUS');

  const activeModelList = AVAILABLE_MODELS.filter(m => activeModels.includes(m.id));

  const renderContent = (content: string, isCode: boolean = false) => {
    if (!content) return <div className="text-gray-600 italic font-mono">Initialized. Awaiting data stream...</div>;
    
    return (
      <div className="prose prose-invert max-w-none prose-p:text-sm prose-pre:bg-black prose-pre:border prose-pre:border-cyber-gray">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full border border-cyber-gray bg-black/50 backdrop-blur-sm rounded-sm shadow-2xl overflow-hidden">
      {/* Tabs Header */}
      <div className="flex overflow-x-auto border-b border-cyber-gray bg-black/80 no-scrollbar">
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

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        {selectedTab === 'CONSENSUS' ? (
          <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-cyber-neon font-mono text-lg tracking-widest flex items-center gap-2">
                <Layers className="text-cyber-pink" />
                NEURAL SYNTHESIS
              </h3>
              {consensus.isReady && (
                <span className="text-xs font-mono text-cyber-yellow bg-cyber-yellow/10 px-2 py-1 rounded border border-cyber-yellow/30">
                  CONFIDENCE: {(consensus.confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <div className="bg-black/60 border border-cyber-neon/30 p-6 rounded shadow-[0_0_30px_rgba(0,243,255,0.05)]">
              {renderContent(consensus.text)}
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
                           STATUS: <span className={resp.status === ModelStatus.ERROR ? 'text-red-500' : 'text-green-500'}>{resp.status}</span>
                           {resp.latency > 0 && ` | ${resp.latency}ms`}
                         </p>
                       </div>
                    </div>
                    <button className="p-2 hover:bg-cyber-gray/50 rounded text-gray-400 hover:text-white transition-colors">
                      <Copy size={16} />
                    </button>
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
  );
};

export default ResponseViewer;
