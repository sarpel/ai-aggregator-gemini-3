import { ModelResponse, ModelStatus, ConsensusResult, ModelProvider, ConsensusStatus } from "../../types";

// Basic stop words list for keyword extraction
const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'is', 'are', 'was', 'were', 'can', 'could', 'should', 'would', 'has', 'had', 'been', 'is', 'are', 'am'
]);

export const generateHeuristicConsensus = (responses: Record<ModelProvider, ModelResponse>): ConsensusResult => {
  const completedResponses = Object.values(responses).filter(r => 
    (r.status === ModelStatus.COMPLETED || r.status === ModelStatus.TIMEOUT) && r.text.trim().length > 0
  );
  
  if (completedResponses.length === 0) {
    return {
      status: ConsensusStatus.IDLE,
      text: "",
      confidence: 0,
      contributors: [],
    };
  }

  // 1. Text Analysis & Keyword Extraction
  const allText = completedResponses.map(r => r.text).join(' ').toLowerCase();
  // Remove punctuation and split
  const words = allText.replace(/[^\w\s]/g, '').split(/\s+/);
  const wordFreq: Record<string, number> = {};
  
  words.forEach(w => {
    if (w.length > 3 && !STOP_WORDS.has(w)) {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    }
  });

  // Get top keywords (appearing frequently across the board)
  const topKeywords = Object.entries(wordFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([k]) => k);

  // 2. Response Scoring & Weighting
  const totalChars = completedResponses.reduce((acc, r) => acc + r.text.length, 0);
  const avgLength = totalChars / completedResponses.length;

  const scoredResponses = completedResponses.map(r => {
    const text = r.text.toLowerCase();
    
    // Factor A: Keyword Agreement (Do you mention the main topics?)
    const keywordHits = topKeywords.reduce((count, kw) => count + (text.includes(kw) ? 1 : 0), 0);
    const agreementScore = keywordHits / (topKeywords.length || 1);

    // Factor B: Length (Penalize extremely short responses, normalize others)
    // Logarithmic scaling for length to diminish returns on massive info dumps
    // If response is 0 length, score is 0. If response is avg length, score is roughly 0.6-0.8
    const lengthScore = Math.min(1, Math.log(r.text.length + 1) / Math.log(avgLength * 2 + 100));

    // Factor C: Complexity (Code blocks, lists)
    const hasCode = r.text.includes('```');
    const hasLists = r.text.includes('\n- ') || r.text.includes('\n1. ');
    const complexityScore = (hasCode ? 0.2 : 0) + (hasLists ? 0.1 : 0);

    // Factor D: Latency (Slight bonus for faster responses, assuming confidence/availability)
    // Normalize latency: inverted score. Max latency considered 10s for scoring.
    const latencyScore = Math.max(0, 1 - (r.latency / 10000)); 

    // Composite Weight Calculation
    // Agreement is king (40%), Content/Length (30%), Structure (20%), Speed (10%)
    let rawWeight = (agreementScore * 0.4) + (lengthScore * 0.3) + (complexityScore * 0.2) + (latencyScore * 0.1);
    
    return {
      ...r,
      rawWeight
    };
  });

  const totalWeight = scoredResponses.reduce((acc, r) => acc + r.rawWeight, 0);
  
  const contributors = scoredResponses.map(r => ({
    provider: r.provider,
    weight: parseFloat((r.rawWeight / (totalWeight || 1)).toFixed(2))
  })).sort((a, b) => b.weight - a.weight);

  // 3. Synthesis Construction
  const bestResponse = scoredResponses.sort((a, b) => b.rawWeight - a.rawWeight)[0];
  
  // Extract "Common Ground" sentences containing top keywords
  // Split by sentence delimiters
  const allSentences = completedResponses.flatMap(r => 
    r.text.match(/[^.!?\n]+[.!?\n]+/g) || []
  ).map(s => s.trim());

  const keyInsights = Array.from(new Set(allSentences)) // Deduplicate identical sentences
    .filter(s => s.length > 40 && s.length < 300) // Filter noise and huge paragraphs
    .map(s => {
      // Score sentence by keyword density
      const sWords = s.toLowerCase().split(/\s+/);
      const score = sWords.reduce((acc, w) => acc + (topKeywords.includes(w) ? 1 : 0), 0);
      return { text: s, score };
    })
    .sort((a, b) => b.score - a.score) // Sort by relevance
    .slice(0, 4) // Top 4 insights
    .map(i => i.text);

  // Construct Final Output
  let synthesisText = `## NEUROSYNC CORE [HEURISTIC MODE v2.1]\n\n`;
  
  synthesisText += `### 📊 Analysis Vectors\n`;
  synthesisText += `**Dominant Entities:** ${topKeywords.slice(0, 5).join(', ') || 'None detected'}\n`;
  synthesisText += `**Primary Source:** ${bestResponse.provider} (Weight: ${(bestResponse.rawWeight / (totalWeight || 1) * 100).toFixed(0)}%)\n\n`;
  
  synthesisText += `### 🧠 Key Convergences\n`;
  if (keyInsights.length > 0) {
    synthesisText += keyInsights.map(s => `* ${s}`).join('\n');
  } else {
    synthesisText += `* _Insufficient data for convergence extraction. Using primary source summary._`;
  }

  synthesisText += `\n\n### 💠 Consolidated Answer\n`;
  // In heuristic mode, blindly merging text is risky. 
  // We present the best weighted response as the core, augmented by the insights above.
  synthesisText += bestResponse.text;

  // Confidence based on how "agreed" the top response is compared to others
  const confidence = Math.min(0.99, (contributors[0]?.weight || 0.5) + 0.3); 

  return {
    status: ConsensusStatus.COMPLETED,
    text: synthesisText,
    confidence,
    contributors,
  };
};

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