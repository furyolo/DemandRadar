import { randomUUID } from 'node:crypto';
import type { Demand, MarketEvidence, ReportLocale, Score, Source, SupplyDemandAnalysis } from '../pipeline/types.js';
import { ScoreSchema } from '../pipeline/types.js';
import { analyzeCreatorFit } from './creatorFit.js';
import { defaultScoringWeights, type ScoringWeights } from './weights.js';

export function scoreOpportunity(
  demand: Demand,
  evidence: MarketEvidence[],
  weights: ScoringWeights = defaultScoringWeights,
  generatedAt = new Date().toISOString(),
  sources: Source[] = [],
  locale: ReportLocale = 'en',
  supplyAnalysis?: SupplyDemandAnalysis
): Score {
  const freshness = sourceFreshness(demand, sources);
  const creatorFit = analyzeCreatorFit({ demand, evidence, locale });
  const baseFeasibility = 70 + Math.round(demand.confidence * 20);
  const dimension_scores = supplyAnalysis
    ? dimensionsFromSupplyAnalysis(supplyAnalysis, evidence, creatorFit.score)
    : {
        demand_strength: clamp(Math.round(demand.confidence * 100)),
        market_size: clamp(scoreEvidence(evidence, ['tam', 'sam', 'som'])),
        willingness_to_pay: clamp(scoreEvidence(evidence, ['willingness_to_pay', 'competitor'])),
        feasibility: clamp(baseFeasibility * 0.45 + creatorFit.score * 0.55)
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
  const explanation = formatScoreExplanation(dimension_scores, freshness, creatorFit, locale, supplyAnalysis);

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

function dimensionsFromSupplyAnalysis(
  analysis: SupplyDemandAnalysis,
  evidence: MarketEvidence[],
  fallbackCreatorFitScore: number
): Score['dimension_scores'] {
  const assessment = analysis.scoring_assessment;
  const creatorFitBase = mapCreatorStatus(analysis.creator_capability_fit.status);
  const agentAdjustment = mapAgentFeasibility(assessment.agent_feasibility);
  const supplyGapAdjustment = mapSupplyGap(assessment.supply_gap);
  return {
    demand_strength: levelScore(assessment.demand_strength, { high: 90, medium: 65, low: 35, none: 10 }),
    market_size: clamp(scoreEvidence(evidence, ['tam', 'sam', 'som'])),
    willingness_to_pay: levelScore(assessment.payment_signal, { explicit: 85, inferred: 65, weak: 40, none: 15 }),
    feasibility: clamp((creatorFitBase + fallbackCreatorFitScore) / 2 + agentAdjustment + supplyGapAdjustment)
  };
}

function levelScore<T extends string>(value: T, scores: Record<T, number>): number {
  return clamp(scores[value]);
}

function mapCreatorStatus(status: SupplyDemandAnalysis['creator_capability_fit']['status']): number {
  switch (status) {
    case 'direct':
      return 86;
    case 'orchestrate':
      return 72;
    case 'not_fit':
      return 38;
  }
}

function mapAgentFeasibility(feasibility: SupplyDemandAnalysis['scoring_assessment']['agent_feasibility']): number {
  switch (feasibility) {
    case 'high':
      return 8;
    case 'medium':
      return 0;
    case 'low':
      return -16;
  }
}

function mapSupplyGap(gap: SupplyDemandAnalysis['scoring_assessment']['supply_gap']): number {
  switch (gap) {
    case 'severe':
      return -10;
    case 'clear':
      return 2;
    case 'minor':
      return 6;
    case 'none':
      return 10;
    case 'unknown':
      return -4;
  }
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

function formatScoreExplanation(
  dimensionScores: Score['dimension_scores'],
  freshness: { penalty: number; reason: string },
  creatorFit: ReturnType<typeof analyzeCreatorFit>,
  locale: ReportLocale,
  supplyAnalysis?: SupplyDemandAnalysis
): string {
  if (locale === 'zh-CN') {
    const fit = supplyAnalysis
      ? `个人能力匹配：${supplyAnalysis.creator_capability_fit.specific_reason}`
      : `个人能力匹配：${creatorFit.personalFit}`;
    const base = `需求强度 ${dimensionScores.demand_strength}，市场规模 ${dimensionScores.market_size}，支付意愿 ${dimensionScores.willingness_to_pay}，可行性 ${dimensionScores.feasibility}。${fit}`;
    return freshness.penalty > 0 ? `${base} 时效惩罚 ${freshness.penalty}：${translateFreshnessReason(freshness.reason)}。` : base;
  }
  const fit = supplyAnalysis
    ? `Creator capability fit: ${supplyAnalysis.creator_capability_fit.specific_reason}`
    : `Creator capability fit: ${creatorFit.personalFit}`;
  return [
    `Demand strength ${dimensionScores.demand_strength}, market size ${dimensionScores.market_size}, willingness to pay ${dimensionScores.willingness_to_pay}, feasibility ${dimensionScores.feasibility}.`,
    fit,
    freshness.penalty > 0 ? `Freshness penalty ${freshness.penalty}: ${freshness.reason}.` : null
  ].filter(Boolean).join(' ');
}

function translateFreshnessReason(reason: string): string {
  switch (reason) {
    case 'no matched source freshness metadata':
      return '没有匹配到来源时效元数据';
    case 'one or more cited sources are older than 90 days':
      return '一个或多个引用来源超过 90 天';
    case 'one or more cited sources are 31-90 days old':
      return '一个或多个引用来源已有 31-90 天';
    case 'one or more cited sources are 15-30 days old':
      return '一个或多个引用来源已有 15-30 天';
    case 'cited sources lack publish/update time':
      return '引用来源缺少发布或更新时间';
    case 'cited sources are fresh':
      return '引用来源较新';
    default:
      return reason;
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
