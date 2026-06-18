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

const DemandExtractionResponseSchema = z.object({
  demands: z.array(DemandSchema)
}).strict();

export async function extractDemands(options: ExtractDemandsOptions): Promise<Demand[]> {
  const response = await options.llm.generateJson(DemandExtractionResponseSchema, [
    {
      role: 'system',
      content: 'Return JSON only. Extract source-backed product demand hypotheses with citations and confidence from 0 to 1.'
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
  return response.demands.map((demand) => {
    if (demand.citations.length === 0) throw new Error(`Demand ${demand.id} is missing citations`);
    return DemandSchema.parse(demand);
  });
}
