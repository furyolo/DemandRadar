import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import demandFixture from './fixtures/llm-demand-response.json' with { type: 'json' };
import marketFixture from './fixtures/llm-market-response.json' with { type: 'json' };
import { extractDemands } from '../src/agents/demandExtractor.js';
import { researchMarketEvidence, researchMarketEvidenceBatch } from '../src/agents/marketResearcher.js';
import { analyzeSupplyDemand } from '../src/agents/supplyDemandAnalyst.js';
import { LlmClient } from '../src/integrations/llmClient.js';
import { DemandSchema, type Hotspot, type Source } from '../src/pipeline/types.js';

const now = '2026-06-18T00:00:00.000Z';

class FakeLlm {
  public messages: unknown[] = [];

  constructor(private readonly response: unknown) {}

  async generateJson<T>(schema: z.ZodType<T>, messages: unknown[] = []): Promise<T> {
    this.messages.push(...messages);
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

  it('instructs demand extraction to preserve Chinese source language', async () => {
    const llm = new FakeLlm(demandFixture);
    await extractDemands({
      hotspots: [hotspot()],
      sources: [{ ...source(), snippet: '家长想找上门家教' }],
      llm,
      generatedAt: now
    });

    expect(JSON.stringify(llm.messages)).toContain('If the sources are primarily Chinese, write Simplified Chinese');
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

  it('instructs market research to preserve Chinese demand language', async () => {
    const llm = new FakeLlm(marketFixture);
    const demand = demandFixture.demands[0];
    if (!demand) throw new Error('expected demand fixture');
    await researchMarketEvidence({
      demand: { ...demand, demand_statement: '家长需要上门家教服务' },
      sources: [source()],
      llm,
      generatedAt: now
    });

    expect(JSON.stringify(llm.messages)).toContain('If they are primarily Chinese, write Simplified Chinese');
  });

  it('normalizes batch market evidence ids and foreign keys', async () => {
    const baseDemand = DemandSchema.parse(demandFixture.demands[0]);
    const demandA = { ...baseDemand, id: 'demand-a', run_id: 'run-a' };
    const demandB = { ...baseDemand, id: 'demand-b', run_id: 'run-b' };
    const evidence = await researchMarketEvidenceBatch({
      demands: [demandA, demandB],
      sources: [source()],
      llm: new FakeLlm({
        market_evidence: [
          { ...marketFixture.market_evidence[0], id: 'llm-id', run_id: 'wrong-run', demand_id: 'demand-a' },
          { ...marketFixture.market_evidence[0], id: 'llm-id', run_id: 'wrong-run', demand_id: 'demand-b' }
        ]
      }),
      generatedAt: now
    });

    expect(evidence.map((item) => item.id)).toEqual([
      'evidence-demand-a-1',
      'evidence-demand-b-1'
    ]);
    expect(evidence.map((item) => item.run_id)).toEqual(['run-a', 'run-b']);
  });

  it('normalizes supply-demand analysis ids and asks for demand-specific fields', async () => {
    const llm = new FakeLlm({
      analyses: [{
        id: 'llm-id',
        run_id: 'wrong-run',
        demand_id: 'demand-a',
        creator_capability_fit: {
          status: 'orchestrate',
          specific_reason: 'The creator can build the workflow but needs HR review.',
          missing_capability: ['HR hiring judgment']
        },
        existing_supply_fit: {
          status: 'partial',
          matched_supply: 'Manual HR review services',
          unresolved_gap: 'No fast AI-first review for AI application roles'
        },
        ai_agent_fill: {
          feasibility: 'medium',
          can_do: ['JD matching', 'resume rewrite'],
          cannot_do: ['Final hiring judgment'],
          required_inputs: ['Target JD', 'Resume']
        },
        third_party_supply_path: {
          needed: true,
          provider_type: 'HR reviewer',
          why: 'Human hiring judgment is needed for final advice.',
          handoff_boundary: 'After AI generates the diagnostic draft.'
        },
        scoring_assessment: {
          demand_strength: 'high',
          supply_gap: 'clear',
          agent_feasibility: 'medium',
          payment_signal: 'explicit',
          evidence_quality: 'medium'
        },
        confidence: 0.74,
        generated_at: now
      }]
    });
    const baseDemand = DemandSchema.parse(demandFixture.demands[0]);
    const analyses = await analyzeSupplyDemand({
      demands: [{ ...baseDemand, id: 'demand-a', run_id: 'run-a' }],
      sources: [source()],
      evidence: [],
      llm,
      generatedAt: now,
      outputLocale: 'zh-CN'
    });

    expect(analyses[0]?.id).toBe('supply-analysis-demand-a');
    expect(analyses[0]?.run_id).toBe('run-a');
    expect(JSON.stringify(llm.messages)).toContain('Do not use generic phrases');
    expect(JSON.stringify(llm.messages)).toContain('Simplified Chinese');
  });

  it('accepts common supply analysis response aliases and still returns the strict shape', async () => {
    const llm = new FakeLlm({
      analyses: [{
        demand_id: 'demand-a',
        creator_capability_fit: {
          status: 'orchestrate',
          details: 'Creator can orchestrate the workflow but needs domain review.'
        },
        existing_supply_fit: {
          status: 'partial',
          details: 'Existing tools cover drafting but not domain-specific review.'
        },
        ai_agent_fill: {
          feasibility: 'high',
          can_do: 'Draft',
          cannot_do: 'Final expert review',
          required_inputs: 'Source files'
        },
        third_party_supply_path: 'Expert reviewer after draft generation',
        scoring_assessment: 'medium confidence',
        confidence: 0.6
      }]
    });
    const baseDemand = DemandSchema.parse(demandFixture.demands[0]);
    const analyses = await analyzeSupplyDemand({
      demands: [{ ...baseDemand, id: 'demand-a', run_id: 'run-a' }],
      sources: [source()],
      evidence: [],
      llm,
      generatedAt: now
    });

    expect(analyses[0]?.creator_capability_fit.specific_reason).toContain('Creator can orchestrate');
    expect(analyses[0]?.existing_supply_fit.unresolved_gap).toContain('Existing tools');
    expect(analyses[0]?.ai_agent_fill.can_do).toEqual(['Draft']);
    expect(analyses[0]?.third_party_supply_path.why).toBe('Expert reviewer after draft generation');
    expect(analyses[0]?.scoring_assessment.evidence_quality).toBe('weak');
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
