import type { Demand, MarketEvidence, Score } from '../pipeline/types.js';
import type { ReportLocale } from '../pipeline/types.js';
import { analyzeCreatorFit } from '../scoring/creatorFit.js';

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
  locale?: ReportLocale;
}): SupplyAnalysis {
  const locale = input.locale ?? 'en';
  const creator = analyzeCreatorFit({ demand: input.demand, evidence: input.evidence, locale });
  const competitorEvidence = input.evidence.filter((item) => item.evidence_type === 'competitor');
  const visibleAlternatives = input.demand.current_alternatives.filter((item) => item.trim().length > 0);
  const visibleSupply = [
    ...visibleAlternatives.map((item) => locale === 'zh-CN' ? `当前替代方案：${item}` : `current alternative: ${item}`),
    ...competitorEvidence.map((item) => locale === 'zh-CN' ? `竞品/供给证据：${item.value}` : `competitor evidence: ${item.value}`)
  ];

  const existingSupply = visibleSupply.length > 0
    ? locale === 'zh-CN'
      ? `可见但不完整：${visibleSupply.slice(0, 3).join('； ')}`
      : `Visible but incomplete - ${visibleSupply.slice(0, 3).join('; ')}`
    : locale === 'zh-CN'
      ? '本次未识别到有来源支撑的现有供给'
      : 'No source-backed existing supply identified in this run';
  const supplyGap = visibleSupply.length > 0
    ? locale === 'zh-CN'
      ? `需要验证现有供给是否真的解决了痛点：${input.demand.pain_point}`
      : `Validate whether visible supply resolves the stated pain point: ${input.demand.pain_point}`
    : locale === 'zh-CN'
      ? `供给发现缺口：本次没有抓到可直接满足该痛点的现有服务、提供方或 workaround：${input.demand.pain_point}`
      : `Supply discovery gap - no current provider or workaround was captured for: ${input.demand.pain_point}`;
  const aiAgentFill = creator.aiAgentFit;
  const transactionPath = transactionRoute(creator.mode, visibleSupply.length > 0, locale);
  const thirdPartyPath = creator.thirdPartyPath;

  return {
    creatorFit: creator.personalFit,
    existingSupply,
    supplyGap,
    aiAgentFill,
    transactionPath,
    thirdPartyPath
  };
}

function transactionRoute(
  mode: ReturnType<typeof analyzeCreatorFit>['mode'],
  hasVisibleSupply: boolean,
  locale: ReportLocale
): string {
  if (mode === 'direct') {
    return locale === 'zh-CN'
      ? '先由个人能力直接做 MVP 或服务化验证，再决定是否引入现有供给扩容。'
      : 'Start with creator-led MVP or service delivery, then add existing supply only for scale.';
  }
  if (mode === 'ai_agent_augmented') {
    return locale === 'zh-CN'
      ? '先用个人判断和 AI Agent 作为临时供给完成接单、执行和交付验证。'
      : 'Use creator judgment plus an AI Agent as provisional supply for intake, execution, and delivery validation.';
  }
  return hasVisibleSupply
    ? locale === 'zh-CN'
      ? '先把需求路由给现有供给，再用 AI Agent 做需求确认、匹配比较和未闭环步骤补足。'
      : 'Route demand to existing supply first, then use an AI Agent to qualify intent, compare fit, and fill unresolved workflow steps.'
    : locale === 'zh-CN'
      ? '先寻找第三方供给，AI Agent 只负责获客、分诊、资料准备和转介。'
      : 'Find third-party supply first; use the AI Agent only for acquisition, triage, preparation, and referral.';
}
