
import { ModelResponse, ModelStatus, ModelProvider } from "../../types";

export const prepareSynthesisPrompt = (
  originalPrompt: string, 
  responses: Record<ModelProvider, ModelResponse>
): string => {
  const activeResponses = Object.values(responses)
    .filter(r => r.status === ModelStatus.COMPLETED || r.status === ModelStatus.TIMEOUT)
    .filter(r => r.text.trim().length > 0);

  let prompt = `USER QUERY: "${originalPrompt}"\n\n`;
  prompt += `Here are the responses from various AI models. Your task is to synthesize them into a single, superior, truth-seeking answer. Harmonize conflicts and merge unique insights.\n\n`;

  activeResponses.forEach(r => {
    prompt += `--- START RESPONSE FROM ${r.provider} ---\n${r.text}\n--- END RESPONSE FROM ${r.provider} ---\n\n`;
  });

  return prompt;
};
