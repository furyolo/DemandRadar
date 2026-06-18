import { z } from 'zod';
import type { LlmMessage } from '../integrations/llmClient.js';
import type { Demand, MarketEvidence, Source } from '../pipeline/types.js';
import { MarketEvidenceSchema } from '../pipeline/types.js';

export interface MarketResearchLlm {
  generateJson<T>(schema: z.ZodType<T>, messages: LlmMessage[]): Promise<T>;
}

export interface ResearchMarketEvidenceOptions {
  demand: Demand;
  sources: Source[];
  llm: MarketResearchLlm;
  generatedAt: string;
}

const MarketResearchResponseSchema = z.object({
  market_evidence: z.array(MarketEvidenceSchema)
}).strict();

export async function researchMarketEvidence(options: ResearchMarketEvidenceOptions): Promise<MarketEvidence[]> {
  const response = await options.llm.generateJson(MarketResearchResponseSchema, [
    {
      role: 'system',
      content: 'Return JSON only. Estimate TAM/SAM/SOM and market signals with source_url, search_query, time_window, confidence, and generated_at.'
    },
    {
      role: 'user',
      content: JSON.stringify({
        generated_at: options.generatedAt,
        demand: options.demand,
        sources: options.sources
      })
    }
  ]);
  return response.market_evidence.map((item) => MarketEvidenceSchema.parse(item));
}
