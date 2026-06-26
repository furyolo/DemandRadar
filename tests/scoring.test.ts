import { describe, expect, it } from 'vitest';
import { analyzeCreatorFit } from '../src/scoring/creatorFit.js';
import { rankDemandScores, scoreOpportunity } from '../src/scoring/scoreOpportunity.js';
import type { Demand, MarketEvidence, Score, Source, SupplyDemandAnalysis } from '../src/pipeline/types.js';

const now = '2026-06-18T00:00:00.000Z';

describe('scoring', () => {
  it('computes weighted score and ranks descending', () => {
    const score = scoreOpportunity(demand('demand-1', 0.8), evidence('demand-1'), undefined, now);
    const lower: Score = { ...score, id: 'score-low', demand_id: 'demand-2', total_score: 10 };
    expect(score.dimension_scores.demand_strength).toBe(80);
    expect(score.explanation).toContain('Creator capability fit');
    expect(rankDemandScores([lower, score])[0]?.id).toBe(score.id);
  });

  it('penalizes stale RedNote demand sources', () => {
    const fresh = scoreOpportunity(demand('demand-1', 0.9), evidence('demand-1'), undefined, now, [
      source('https://example.com/story', 'fresh')
    ]);
    const expired = scoreOpportunity(demand('demand-1', 0.9), evidence('demand-1'), undefined, now, [
      source('https://example.com/story', 'expired')
    ]);

    expect(expired.total_score).toBeLessThan(fresh.total_score);
    expect(expired.explanation).toContain('Freshness penalty 35');
  });

  it('raises feasibility when demand matches creator capability and AI-agentable delivery', () => {
    const fit = analyzeCreatorFit({
      demand: {
        ...demand('demand-1', 0.8),
        pain_point: 'Manual data research and workflow comparison are slow',
        demand_statement: 'Build an AI Agent workflow that automates opportunity research and reports'
      },
      evidence: evidence('demand-1')
    });
    const score = scoreOpportunity({
      ...demand('demand-1', 0.8),
      pain_point: 'Manual data research and workflow comparison are slow',
      demand_statement: 'Build an AI Agent workflow that automates opportunity research and reports'
    }, evidence('demand-1'), undefined, now);

    expect(fit.mode).toBe('direct');
    expect(score.dimension_scores.feasibility).toBeGreaterThanOrEqual(80);
  });

  it('uses structured supply-demand assessment for scoring dimensions without letting the LLM set total score', () => {
    const score = scoreOpportunity(
      demand('demand-1', 0.3),
      evidence('demand-1'),
      undefined,
      now,
      [],
      'en',
      supplyAnalysis('demand-1')
    );

    expect(score.dimension_scores.demand_strength).toBe(90);
    expect(score.dimension_scores.willingness_to_pay).toBe(85);
    expect(score.explanation).toContain('The creator can own the document workflow');
    expect(score.total_score).toBeGreaterThan(50);
  });

  it('routes licensed offline fulfillment toward third-party supply', () => {
    const fit = analyzeCreatorFit({
      demand: {
        ...demand('demand-1', 0.8),
        pain_point: 'Patients need licensed doctor onsite medical treatment',
        demand_statement: 'Match users with regulated medical and onsite delivery providers'
      },
      evidence: []
    });

    expect(fit.mode).toBe('third_party');
    expect(fit.thirdPartyPath).toContain('licensed');
  });
});

function demand(id: string, confidence: number): Demand {
  return {
    id,
    run_id: 'run-1',
    hotspot_id: 'hotspot-1',
    user_profile: 'Builder',
    pain_point: 'Research is slow',
    current_alternatives: ['manual'],
    demand_statement: 'Automate opportunity research',
    citations: [{ source_url: 'https://example.com/story', quote: 'manual research' }],
    confidence,
    generated_at: now
  };
}

function evidence(demand_id: string): MarketEvidence[] {
  return [{
    id: 'evidence-1',
    run_id: 'run-1',
    demand_id,
    evidence_type: 'tam',
    value: 'large',
    source_url: 'https://example.com/report',
    search_query: 'market',
    time_window: '30d',
    confidence: 0.7,
    generated_at: now
  }];
}

function source(url: string, freshness_status: string): Source {
  return {
    id: 'source-1',
    run_id: 'run-1',
    source_url: url,
    title: 'RedNote lead',
    snippet: 'manual research',
    source_name: 'rednote',
    published_at: '2026-01-01',
    search_query: 'rednote',
    time_window: '30d',
    raw: { freshness_status }
  };
}

function supplyAnalysis(demand_id: string): SupplyDemandAnalysis {
  return {
    id: `supply-analysis-${demand_id}`,
    run_id: 'run-1',
    demand_id,
    creator_capability_fit: {
      status: 'orchestrate',
      specific_reason: 'The creator can own the document workflow but needs policy templates.',
      missing_capability: ['Policy template library']
    },
    existing_supply_fit: {
      status: 'partial',
      matched_supply: 'DeepSeek and document writing tools',
      unresolved_gap: 'They do not combine PDF upload, retrieval, and simple public-document drafting.'
    },
    ai_agent_fill: {
      feasibility: 'high',
      can_do: ['PDF extraction', 'retrieval', 'drafting'],
      cannot_do: ['Guarantee policy correctness'],
      required_inputs: ['PDF files', 'writing template']
    },
    third_party_supply_path: {
      needed: true,
      provider_type: 'policy template provider',
      why: 'Domain-specific formats need external validation.',
      handoff_boundary: 'After the agent prepares a draft.'
    },
    scoring_assessment: {
      demand_strength: 'high',
      supply_gap: 'clear',
      agent_feasibility: 'high',
      payment_signal: 'explicit',
      evidence_quality: 'medium'
    },
    confidence: 0.8,
    generated_at: now
  };
}
