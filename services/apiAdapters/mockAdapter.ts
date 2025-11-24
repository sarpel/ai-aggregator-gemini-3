
import { ModelResponse, ModelStatus, ModelProvider } from "../../types";

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
  let isActive = true;
  let safetyTimer: NodeJS.Timeout | null = null;
  
  // FIX: Create cleanup function to prevent memory leaks
  const cleanup = () => {
    isActive = false;
    if (safetyTimer) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
  };

  try {
    onUpdate({ status: ModelStatus.CONNECTING, text: '', progress: 5, tokenCount: 0 });
    
    // Artificial connection delay
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1000));

    if (!isActive) return;

    const startTime = Date.now();
    onUpdate({ status: ModelStatus.STREAMING, progress: 10 });

    // Generate a pseudo-random response based on prompt length
    const seed = prompt.length % SIMULATED_RESPONSES.length;
    const baseResponse = `[${provider} PROTOCOL]: Processing query "${prompt.substring(0, 15)}..."\n\n`;
    const content = SIMULATED_RESPONSES[seed] + " " + SIMULATED_RESPONSES[(seed + 1) % SIMULATED_RESPONSES.length];
    
    const fullText = baseResponse + content + "\n\nExecuted in " + (Math.random() * 200).toFixed(2) + "ms.";
    
    // Stream characters
    let currentText = '';
    const chars = fullText.split('');
    
    // Mock Timeout Safety
    safetyTimer = setTimeout(() => {
      cleanup();
      onUpdate({ status: ModelStatus.TIMEOUT, error: 'Mock Timeout' });
    }, 60000);

    for (let i = 0; i < chars.length; i++) {
      if (!isActive) break;

      currentText += chars[i];
      
      // Random streaming speed variation
      if (i % 3 === 0) await new Promise(r => setTimeout(r, 20)); 
      
      if (isActive) {
        onUpdate({ 
          text: currentText,
          latency: Date.now() - startTime,
          progress: 10 + (i / chars.length) * 90,
          tokenCount: Math.ceil(currentText.length / 4)
        });
      }
    }

    if (isActive) {
      cleanup();
      onUpdate({ 
        status: ModelStatus.COMPLETED, 
        text: currentText, 
        progress: 100,
        latency: Date.now() - startTime,
        tokenCount: Math.ceil(fullText.length / 4)
      });
    }
  } catch (error) {
    // FIX: Handle unexpected errors and clean up
    console.error('[Mock Adapter] Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
    cleanup();
    if (isActive) {
      onUpdate({
        status: ModelStatus.ERROR,
        error: `Mock adapter error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
};
