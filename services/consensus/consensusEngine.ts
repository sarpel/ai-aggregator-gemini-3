import { ModelResponse, ModelStatus, ConsensusResult, ModelProvider } from "../../types";

export const generateConsensus = (responses: Record<ModelProvider, ModelResponse>): ConsensusResult => {
  const completedResponses = Object.values(responses).filter(r => r.status === ModelStatus.COMPLETED && r.text.length > 0);
  
  if (completedResponses.length === 0) {
    return {
      text: "Awaiting neural inputs...",
      confidence: 0,
      contributors: [],
      isReady: false
    };
  }

  // Simple heuristic consensus for the frontend demo
  // In a real app, this would use a local LLM or a specific 'judge' model call
  
  const totalLength = completedResponses.reduce((acc, r) => acc + r.text.length, 0);
  const contributors = completedResponses.map(r => ({
    provider: r.provider,
    weight: parseFloat((r.text.length / totalLength).toFixed(2))
  }));

  const intro = "## NEUROSYNC CONSENSUS\n\nAnalysis of incoming streams indicates a convergence on the following points:\n\n";
  
  // Synthesize by extracting key sentences (heuristic: sentences > 20 chars)
  const sentences = completedResponses
    .flatMap(r => r.text.split(/[.!?\n]/))
    .filter(s => s.length > 20 && s.length < 150)
    .map(s => s.trim());

  // Deduplicate similar sentences (very basic)
  const uniqueSentences = Array.from(new Set(sentences)).slice(0, 5); // Pick top 5 distinct ideas

  const synthesis = uniqueSentences.map(s => `* ${s}`).join('\n');
  
  const outro = "\n\n**Confidence Level**: " + (85 + Math.random() * 14).toFixed(1) + "%";

  return {
    text: intro + synthesis + outro,
    confidence: 0.9,
    contributors,
    isReady: true
  };
};
