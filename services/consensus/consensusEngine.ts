
import { ModelResponse, ModelStatus, ModelProvider } from "../../types";

export const prepareSynthesisPrompt = (
  originalPrompt: string,
  responses: Record<ModelProvider, ModelResponse>
): string => {
  const activeResponses = Object.values(responses)
    .filter(r => r.status === ModelStatus.COMPLETED || r.status === ModelStatus.TIMEOUT)
    .filter(r => r.text.trim().length > 0);

  let prompt = `USER QUERY: "${originalPrompt}"\n\n`;
  prompt += `[INCOMING INTELLIGENCE STREAMS DETECTED]\n`;
  prompt += `SOURCE: PARALLEL AI TIMELINES\n`;
  prompt += `DIRECTIVE: ANALYZE, CROSS-REFERENCE, AND SYNTHESIZE. EXTRACT THE GOLDEN TRUTH.\n\n`;

  activeResponses.forEach(r => {
    prompt += `--- START RESPONSE FROM ${r.provider} ---\n${r.text}\n--- END RESPONSE FROM ${r.provider} ---\n\n`;
  });

  return prompt;
};
