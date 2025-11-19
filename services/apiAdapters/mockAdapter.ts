import { ModelResponse, ModelStatus, ModelProvider } from "../../types";

// In a real production app, these would be individual files (openaiAdapter.ts, etc.)
// interacting with their respective APIs. Due to CORS restrictions on calling 
// OpenAI/Anthropic directly from browser without a proxy, and to allow this demo 
// to work immediately, we use a sophisticated simulation.

const SIMULATED_RESPONSES = [
  "Based on my analysis of the vector space, I concur with the premise.",
  "The neural pathways suggest a high probability of success.",
  "Optimizing parameters... The solution lies in the recursive depth.",
  "Cross-referencing global databases... Found 3 matches.",
  "Synthesizing output. The logic is sound but requires verification."
];

export const streamMock = async (
  provider: ModelProvider,
  prompt: string,
  onUpdate: (data: Partial<ModelResponse>) => void
) => {
  onUpdate({ status: ModelStatus.CONNECTING, text: '', progress: 5 });
  
  // Artificial connection delay
  await new Promise(r => setTimeout(r, 800 + Math.random() * 1000));

  const startTime = Date.now();
  onUpdate({ status: ModelStatus.STREAMING, progress: 10 });

  // Generate a pseudo-random response based on prompt length to seem dynamic
  const seed = prompt.length % SIMULATED_RESPONSES.length;
  const baseResponse = `[${provider} PROTOCOL]: Processing query "${prompt.substring(0, 15)}..."\n\n`;
  const content = SIMULATED_RESPONSES[seed] + " " + SIMULATED_RESPONSES[(seed + 1) % SIMULATED_RESPONSES.length];
  
  const fullText = baseResponse + content + "\n\nExecuted in " + (Math.random() * 200).toFixed(2) + "ms.";
  
  // Stream characters
  let currentText = '';
  const chars = fullText.split('');
  
  for (let i = 0; i < chars.length; i++) {
    currentText += chars[i];
    
    // Random streaming speed variation
    if (i % 3 === 0) await new Promise(r => setTimeout(r, 20)); 
    
    onUpdate({ 
      text: currentText,
      latency: Date.now() - startTime,
      progress: 10 + (i / chars.length) * 90
    });
  }

  onUpdate({ 
    status: ModelStatus.COMPLETED, 
    text: currentText, 
    progress: 100,
    latency: Date.now() - startTime 
  });
};
