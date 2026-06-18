import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import demandFixture from './fixtures/llm-demand-response.json' with { type: 'json' };
import marketFixture from './fixtures/llm-market-response.json' with { type: 'json' };
import { extractDemands } from '../src/agents/demandExtractor.js';
import { researchMarketEvidence } from '../src/agents/marketResearcher.js';
import { LlmClient } from '../src/integrations/llmClient.js';
import type { Hotspot, Source } from '../src/pipeline/types.js';

const now = '2026-06-18T00:00:00.000Z';

class FakeLlm {
  constructor(private readonly response: unknown) {}

  async generateJson<T>(schema: z.ZodType<T>): Promise<T> {
    return schema.parse(this.response);
  }
}

describe('LLM agents', () => {
  it('parses valid demand fixture JSON', async () => {
    const demands = await extractDemands({
      hotspots: [hotspot()],
      sources: [source()],
      llm: new FakeLlm(demandFixture),
      generatedAt: now
    });
    expect(demands[0]?.citations[0]?.source_url).toBe('https://example.com/story');
  });

  it('parses valid market evidence fixture JSON', async () => {
    const demand = demandFixture.demands[0];
    if (!demand) throw new Error('expected demand fixture');
    const evidence = await researchMarketEvidence({
      demand,
      sources: [source()],
      llm: new FakeLlm(marketFixture),
      generatedAt: now
    });
    expect(evidence[0]?.source_url).toBe('https://example.com/report');
  });

  it('rejects malformed fixture JSON through schema validation', async () => {
    await expect(extractDemands({
      hotspots: [hotspot()],
      sources: [source()],
      llm: new FakeLlm({ demands: [{ id: 'bad' }] }),
      generatedAt: now
    })).rejects.toThrow();
  });

  it('reports missing LLM config before network use', () => {
    const previousKey = process.env.LLM_API_KEY;
    const previousModel = process.env.LLM_MODEL;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
    expect(() => new LlmClient()).toThrow('Missing LLM_API_KEY');
    process.env.LLM_API_KEY = previousKey;
    process.env.LLM_MODEL = previousModel;
  });
});

function source(): Source {
  return {
    id: 'source-1',
    run_id: 'run-1',
    source_url: 'https://example.com/story',
    title: 'Story',
    snippet: 'Signal',
    source_name: 'Example',
    published_at: null,
    search_query: 'query',
    time_window: '30d',
    raw: {}
  };
}

function hotspot(): Hotspot {
  return {
    id: 'hotspot-1',
    run_id: 'run-1',
    title: 'Story',
    summary: 'Signal',
    domain: 'technology',
    source_ids: ['source-1'],
    canonical_url: 'https://example.com/story',
    heat_score: 70,
    search_query: 'query',
    time_window: '30d',
    generated_at: now
  };
}
