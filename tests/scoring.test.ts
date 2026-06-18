import { describe, expect, it } from 'vitest';
import { rankDemandScores, scoreOpportunity } from '../src/scoring/scoreOpportunity.js';
import type { Demand, MarketEvidence, Score } from '../src/pipeline/types.js';

const now = '2026-06-18T00:00:00.000Z';

describe('scoring', () => {
  it('computes weighted score and ranks descending', () => {
    const score = scoreOpportunity(demand('demand-1', 0.8), evidence('demand-1'), undefined, now);
    const lower: Score = { ...score, id: 'score-low', demand_id: 'demand-2', total_score: 10 };
    expect(score.dimension_scores.demand_strength).toBe(80);
    expect(rankDemandScores([lower, score])[0]?.id).toBe(score.id);
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
