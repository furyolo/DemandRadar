import { describe, expect, it } from 'vitest';
import { rankDemandScores, scoreOpportunity } from '../src/scoring/scoreOpportunity.js';
import type { Demand, MarketEvidence, Score, Source } from '../src/pipeline/types.js';

const now = '2026-06-18T00:00:00.000Z';

describe('scoring', () => {
  it('computes weighted score and ranks descending', () => {
    const score = scoreOpportunity(demand('demand-1', 0.8), evidence('demand-1'), undefined, now);
    const lower: Score = { ...score, id: 'score-low', demand_id: 'demand-2', total_score: 10 };
    expect(score.dimension_scores.demand_strength).toBe(80);
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
