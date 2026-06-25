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

export interface ResearchMarketEvidenceBatchOptions {
  demands: Demand[];
  sources: Source[];
  llm: MarketResearchLlm;
  generatedAt: string;
}

const MarketResearchResponseSchema = z.object({
  market_evidence: z.array(MarketEvidenceSchema)
}).strict();

export async function researchMarketEvidence(options: ResearchMarketEvidenceOptions): Promise<MarketEvidence[]> {
  const evidence = await researchMarketEvidenceBatch({
    demands: [options.demand],
    sources: options.sources,
    llm: options.llm,
    generatedAt: options.generatedAt
  });
  return evidence.filter((item) => item.demand_id === options.demand.id);
}

export async function researchMarketEvidenceBatch(options: ResearchMarketEvidenceBatchOptions): Promise<MarketEvidence[]> {
  if (options.demands.length === 0) return [];
  const response = await options.llm.generateJson(MarketResearchResponseSchema, [
    {
      role: 'system',
      content: [
        'Return JSON only with a top-level "market_evidence" array.',
        'Estimate TAM, SAM, SOM, competitors, willingness-to-pay signals, or community signals when source-backed evidence is available for each demand.',
        'Prioritize competitor evidence that explains whether current supply can already satisfy the demand and what gap remains.',
        'Every market_evidence object must exactly include: id, run_id, demand_id, evidence_type, value, source_url, search_query, time_window, confidence, generated_at.',
        'evidence_type must be one of: tam, sam, som, competitor, willingness_to_pay, community_signal.',
        'Use only the provided demand ids for demand_id. Use the provided run ids and generated_at value.',
        'Return 2 to 5 market_evidence objects per demand when evidence is available, including at least one competitor item when source-backed supply evidence exists. Return no objects for a demand rather than inventing evidence.',
        'Do not include evidence without a valid source_url. Mark uncertainty through lower confidence.',
        'Write all user-facing evidence values in the dominant language of the provided demands and sources. If they are primarily Chinese, write Simplified Chinese; do not switch to English.'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify({
        generated_at: options.generatedAt,
        demands: options.demands,
        sources: options.sources
      })
    }
  ]);
  const demandById = new Map(options.demands.map((demand) => [demand.id, demand]));
  const evidenceCountByDemand = new Map<string, number>();
  return response.market_evidence.map((item) => {
    const demand = demandById.get(item.demand_id);
    if (!demand) throw new Error(`Market evidence referenced unknown demand id: ${item.demand_id}`);
    const index = (evidenceCountByDemand.get(demand.id) ?? 0) + 1;
    evidenceCountByDemand.set(demand.id, index);
    return MarketEvidenceSchema.parse({
      ...item,
      id: `evidence-${demand.id}-${index}`,
      run_id: demand.run_id,
      demand_id: demand.id
    });
  });
}
