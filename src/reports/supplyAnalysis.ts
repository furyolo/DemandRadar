import type { Demand, MarketEvidence, Score, SupplyDemandAnalysis as StructuredSupplyDemandAnalysis } from '../pipeline/types.js';
import type { ReportLocale } from '../pipeline/types.js';
import { fallbackSupplyDemandAnalysis } from '../scoring/supplyDemandFallback.js';

export interface SupplyAnalysis {
  creatorFit: string;
  existingSupply: string;
  supplyGap: string;
  aiAgentFill: string;
  transactionPath: string;
  thirdPartyPath: string;
}

export function analyzeSupplyFit(input: {
  demand: Demand;
  evidence: MarketEvidence[];
  score: Score;
  analysis?: StructuredSupplyDemandAnalysis;
  locale?: ReportLocale;
}): SupplyAnalysis {
  const locale = input.locale ?? 'en';
  if (input.analysis) return fromStructuredAnalysis(input.analysis, locale);
  return fromStructuredAnalysis(fallbackSupplyDemandAnalysis({
    demand: input.demand,
    evidence: input.evidence,
    generatedAt: input.score.generated_at,
    locale
  }), locale);
}

function fromStructuredAnalysis(analysis: StructuredSupplyDemandAnalysis, locale: ReportLocale): SupplyAnalysis {
  const zh = locale === 'zh-CN';
  return {
    creatorFit: zh
      ? `${creatorStatusLabel(analysis.creator_capability_fit.status, locale)}：${analysis.creator_capability_fit.specific_reason}${formatListSuffix('缺口', analysis.creator_capability_fit.missing_capability, locale)}`
      : `${creatorStatusLabel(analysis.creator_capability_fit.status, locale)}: ${analysis.creator_capability_fit.specific_reason}${formatListSuffix('gaps', analysis.creator_capability_fit.missing_capability, locale)}`,
    existingSupply: zh
      ? `${existingSupplyLabel(analysis.existing_supply_fit.status, locale)}：${analysis.existing_supply_fit.matched_supply}；未解决：${analysis.existing_supply_fit.unresolved_gap}`
      : `${existingSupplyLabel(analysis.existing_supply_fit.status, locale)}: ${analysis.existing_supply_fit.matched_supply}; unresolved: ${analysis.existing_supply_fit.unresolved_gap}`,
    supplyGap: analysis.existing_supply_fit.unresolved_gap,
    aiAgentFill: zh
      ? `${agentLabel(analysis.ai_agent_fill.feasibility, locale)}：可做 ${joinItems(analysis.ai_agent_fill.can_do, locale)}；不能做 ${joinItems(analysis.ai_agent_fill.cannot_do, locale)}；需要 ${joinItems(analysis.ai_agent_fill.required_inputs, locale)}`
      : `${agentLabel(analysis.ai_agent_fill.feasibility, locale)}: can do ${joinItems(analysis.ai_agent_fill.can_do, locale)}; cannot do ${joinItems(analysis.ai_agent_fill.cannot_do, locale)}; needs ${joinItems(analysis.ai_agent_fill.required_inputs, locale)}`,
    transactionPath: transactionPathLabel(analysis, locale),
    thirdPartyPath: zh
      ? `${analysis.third_party_supply_path.needed ? '需要撮合' : '暂不需要撮合'}：${analysis.third_party_supply_path.provider_type}；原因：${analysis.third_party_supply_path.why}；边界：${analysis.third_party_supply_path.handoff_boundary}`
      : `${analysis.third_party_supply_path.needed ? 'Brokerage needed' : 'Brokerage not needed yet'}: ${analysis.third_party_supply_path.provider_type}; why: ${analysis.third_party_supply_path.why}; boundary: ${analysis.third_party_supply_path.handoff_boundary}`
  };
}

function transactionPathLabel(analysis: StructuredSupplyDemandAnalysis, locale: ReportLocale): string {
  const creatorStatus = analysis.creator_capability_fit.status;
  const agentFeasibility = analysis.ai_agent_fill.feasibility;
  if (locale === 'zh-CN') {
    if (creatorStatus === 'direct') return '优先自营交付，利润主要归个人；AI Agent 只作为效率工具。';
    if (agentFeasibility !== 'low') return '优先采用个人 + AI Agent 增强自营交付，成本主要是工具/API 和人工复核。';
    return `自营和 Agent 都不足时，转为外部供给撮合，在“${analysis.third_party_supply_path.handoff_boundary}”处交给${analysis.third_party_supply_path.provider_type}，主要赚取中介费或差价。`;
  }
  if (creatorStatus === 'direct') return 'Prefer creator-owned fulfillment; most profit stays with the creator and the AI Agent is only an efficiency layer.';
  if (agentFeasibility !== 'low') return 'Prefer creator + AI Agent augmented fulfillment, with costs mainly from tools/APIs and human review.';
  return `If creator-owned and Agent fulfillment are insufficient, switch to external supply brokerage, hand off at "${analysis.third_party_supply_path.handoff_boundary}" to ${analysis.third_party_supply_path.provider_type}, and earn brokerage margin.`;
}

function creatorStatusLabel(status: StructuredSupplyDemandAnalysis['creator_capability_fit']['status'], locale: ReportLocale): string {
  if (locale !== 'zh-CN') return status;
  switch (status) {
    case 'direct':
      return '可直接切入';
    case 'orchestrate':
      return '适合产品化/编排';
    case 'not_fit':
      return '不适合直接履约';
  }
}

function existingSupplyLabel(status: StructuredSupplyDemandAnalysis['existing_supply_fit']['status'], locale: ReportLocale): string {
  if (locale !== 'zh-CN') return status;
  switch (status) {
    case 'sufficient':
      return '供给充分';
    case 'partial':
      return '供给部分满足';
    case 'missing':
      return '供给缺失';
    case 'unknown':
      return '供给未知';
  }
}

function agentLabel(feasibility: StructuredSupplyDemandAnalysis['ai_agent_fill']['feasibility'], locale: ReportLocale): string {
  if (locale !== 'zh-CN') return feasibility;
  switch (feasibility) {
    case 'high':
      return 'Agent 可行性高';
    case 'medium':
      return 'Agent 可行性中';
    case 'low':
      return 'Agent 可行性低';
  }
}

function formatListSuffix(label: string, items: string[], locale: ReportLocale): string {
  if (items.length === 0) return '';
  return locale === 'zh-CN' ? `；${label}：${items.join('、')}` : `; ${label}: ${items.join(', ')}`;
}

function joinItems(items: string[], locale: ReportLocale): string {
  if (items.length === 0) return locale === 'zh-CN' ? '无明确证据' : 'no explicit evidence';
  return items.join(locale === 'zh-CN' ? '、' : ', ');
}
