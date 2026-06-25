import { randomUUID } from 'node:crypto';
import type { Demand, MarketEvidence, Score, Source } from '../pipeline/types.js';
import { ScoreSchema } from '../pipeline/types.js';
import { defaultScoringWeights, type ScoringWeights } from './weights.js';

export function scoreOpportunity(
  demand: Demand,
  evidence: MarketEvidence[],
  weights: ScoringWeights = defaultScoringWeights,
  generatedAt = new Date().toISOString(),
  sources: Source[] = []
): Score {
  const freshness = sourceFreshness(demand, sources);
  const dimension_scores = {
    demand_strength: clamp(Math.round(demand.confidence * 100)),
    market_size: clamp(scoreEvidence(evidence, ['tam', 'sam', 'som'])),
    willingness_to_pay: clamp(scoreEvidence(evidence, ['willingness_to_pay', 'competitor'])),
    feasibility: clamp(70 + Math.round(demand.confidence * 20))
  };
  const base_score = clamp(
    dimension_scores.demand_strength * weights.demand_strength +
    dimension_scores.market_size * weights.market_size +
    dimension_scores.willingness_to_pay * weights.willingness_to_pay +
    dimension_scores.feasibility * weights.feasibility
  );
  const total_score = clamp(base_score - freshness.penalty);
  const confidence = evidence.length > 0
    ? (demand.confidence + evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length) / 2
    : demand.confidence * 0.7;
  const explanation = [
    `Demand strength ${dimension_scores.demand_strength}, market size ${dimension_scores.market_size}, willingness to pay ${dimension_scores.willingness_to_pay}, feasibility ${dimension_scores.feasibility}.`,
    freshness.penalty > 0 ? `Freshness penalty ${freshness.penalty}: ${freshness.reason}.` : null
  ].filter(Boolean).join(' ');

  return ScoreSchema.parse({
    id: `score-${randomUUID()}`,
    run_id: demand.run_id,
    demand_id: demand.id,
    dimension_scores,
    total_score,
    explanation,
    confidence: Math.max(0, Math.min(1, confidence - freshness.penalty / 200)),
    generated_at: generatedAt
  });
}

export function rankDemandScores(scores: Score[], limit = 10): Score[] {
  return [...scores]
    .sort((a, b) => b.total_score - a.total_score || b.confidence - a.confidence)
    .slice(0, limit);
}

function scoreEvidence(evidence: MarketEvidence[], types: MarketEvidence['evidence_type'][]): number {
  const matches = evidence.filter((item) => types.includes(item.evidence_type));
  if (matches.length === 0) return 40;
  return Math.round(50 + Math.min(45, matches.reduce((sum, item) => sum + item.confidence * 15, 0)));
}

function sourceFreshness(demand: Demand, sources: Source[]): { penalty: number; reason: string } {
  const citationUrls = new Set(demand.citations.map((citation) => citation.source_url));
  const matched = sources.filter((source) => citationUrls.has(source.source_url));
  if (matched.length === 0) return { penalty: 0, reason: 'no matched source freshness metadata' };

  const statuses = matched.map((source) => source.raw.freshness_status);
  if (statuses.includes('expired')) return { penalty: 35, reason: 'one or more cited sources are older than 90 days' };
  if (statuses.includes('stale')) return { penalty: 18, reason: 'one or more cited sources are 31-90 days old' };
  if (statuses.includes('recent')) return { penalty: 8, reason: 'one or more cited sources are 15-30 days old' };
  if (statuses.every((status) => status === 'unknown' || status === undefined)) return { penalty: 5, reason: 'cited sources lack publish/update time' };
  return { penalty: 0, reason: 'cited sources are fresh' };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
