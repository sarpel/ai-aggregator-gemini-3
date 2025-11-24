
import { ModelResponse, ModelStatus, ModelProvider } from "../../types";

export const prepareSynthesisPrompt = (
  originalPrompt: string,
  responses: Record<ModelProvider, ModelResponse>
): string => {
  // FIX: Validate inputs to prevent crashes
  if (!originalPrompt || typeof originalPrompt !== 'string') {
    throw new Error('Invalid original prompt');
  }

  if (!responses || typeof responses !== 'object') {
    throw new Error('Invalid responses object');
  }

  // FIX: Add null/undefined checks before filtering
  const activeResponses = Object.values(responses)
    .filter(r => r && typeof r === 'object') // FIX: Ensure response exists and is an object
    .filter(r => r.status === ModelStatus.COMPLETED || r.status === ModelStatus.TIMEOUT)
    .filter(r => r.text && r.text.trim().length > 0);

  let prompt = `USER QUERY: "${originalPrompt}"\n\n`;
  prompt += `[INCOMING INTELLIGENCE STREAMS DETECTED]\n`;
  prompt += `SOURCE: PARALLEL AI TIMELINES\n`;
  prompt += `DIRECTIVE: ANALYZE, CROSS-REFERENCE, AND SYNTHESIZE. EXTRACT THE GOLDEN TRUTH.\n\n`;

  // FIX: Handle case where no valid responses exist
  if (activeResponses.length === 0) {
    prompt += `[WARNING: No valid responses received from parallel timelines]\n`;
    return prompt;
  }

  activeResponses.forEach(r => {
    // FIX: Validate provider exists before using it
    const provider = r.provider || 'UNKNOWN';
    prompt += `--- START RESPONSE FROM ${provider} ---\n${r.text}\n--- END RESPONSE FROM ${provider} ---\n\n`;
  });

  return prompt;
};
