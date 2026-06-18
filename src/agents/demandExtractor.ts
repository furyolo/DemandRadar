import { z } from 'zod';
import type { LlmMessage } from '../integrations/llmClient.js';
import type { Demand, Hotspot, Source } from '../pipeline/types.js';
import { DemandSchema } from '../pipeline/types.js';

export interface DemandExtractionLlm {
  generateJson<T>(schema: z.ZodType<T>, messages: LlmMessage[]): Promise<T>;
}

export interface ExtractDemandsOptions {
  hotspots: Hotspot[];
  sources: Source[];
  llm: DemandExtractionLlm;
  generatedAt: string;
}

const DemandFromLlmSchema = DemandSchema.extend({
  current_alternatives: z.preprocess(
    (value) => typeof value === 'string' ? [value] : value,
    z.array(z.string()).default([])
  )
});

const DemandExtractionResponseSchema = z.object({
  demands: z.array(DemandFromLlmSchema).optional(),
  hypotheses: z.array(DemandFromLlmSchema).optional()
}).strict().transform((response) => ({
  demands: response.demands ?? response.hypotheses ?? []
}));

export async function extractDemands(options: ExtractDemandsOptions): Promise<Demand[]> {
  const response = await options.llm.generateJson(DemandExtractionResponseSchema, [
    {
      role: 'system',
      content: [
        'Return JSON only with a top-level "demands" array.',
        'Extract source-backed product demand hypotheses with citations and confidence from 0 to 1.',
        'When the input contains one hotspot, return only the single strongest product demand for that hotspot.',
        'Every demand object must exactly include: id, run_id, hotspot_id, user_profile, pain_point, current_alternatives, demand_statement, citations, confidence, generated_at.',
        'Use the provided hotspot id for hotspot_id, the provided run id for run_id, and the provided generated_at value.',
        'citations must contain objects with source_url and quote. Do not include unsupported claims.'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify({
        generated_at: options.generatedAt,
        hotspots: options.hotspots,
        sources: options.sources
      })
    }
  ]);
  const demands = options.hotspots.length === 1 ? response.demands.slice(0, 1) : response.demands;
  return demands.map((demand, index) => {
    const hotspot = options.hotspots.length === 1 ? options.hotspots[0] : undefined;
    const normalized = DemandSchema.parse({
      ...demand,
      id: hotspot ? `demand-${hotspot.id}-${index + 1}` : demand.id,
      run_id: options.hotspots[0]?.run_id ?? demand.run_id,
      hotspot_id: hotspot?.id ?? demand.hotspot_id
    });
    if (normalized.citations.length === 0) throw new Error(`Demand ${normalized.id} is missing citations`);
    return normalized;
  });
}
