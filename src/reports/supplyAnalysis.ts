import type { Demand, MarketEvidence, Score } from '../pipeline/types.js';
import type { ReportLocale } from '../pipeline/types.js';

export interface SupplyAnalysis {
  existingSupply: string;
  supplyGap: string;
  aiAgentFill: string;
  transactionPath: string;
}

export function analyzeSupplyFit(input: {
  demand: Demand;
  evidence: MarketEvidence[];
  score: Score;
  locale?: ReportLocale;
}): SupplyAnalysis {
  const locale = input.locale ?? 'en';
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
  const aiAgentFill = aiAgentPotential(input.score.dimension_scores.feasibility, visibleSupply.length > 0, locale);
  const transactionPath = visibleSupply.length > 0
    ? locale === 'zh-CN'
      ? '先把需求路由给现有供给，再用 AI Agent 做需求确认、匹配比较和未闭环步骤补足。'
      : 'Route demand to existing supply first, then use an AI Agent to qualify intent, compare fit, and fill unresolved workflow steps.'
    : locale === 'zh-CN'
      ? '先把 AI Agent 作为临时供给用于接单、流程执行和交付，直到验证出可重复的人力或软件供给。'
      : 'Use an AI Agent as provisional supply for intake, workflow execution, and handoff until repeatable human or software supply is validated.';

  return {
    existingSupply,
    supplyGap,
    aiAgentFill,
    transactionPath
  };
}

function aiAgentPotential(feasibility: number, hasVisibleSupply: boolean, locale: ReportLocale): string {
  if (feasibility >= 85) {
    if (locale === 'zh-CN') {
      return hasVisibleSupply
        ? '高：围绕现有供给自动完成需求确认、匹配、协调和最后一公里执行。'
        : '高：用 AI Agent 覆盖接单、分析、执行和交付，同时验证可重复供给。';
    }
    return hasVisibleSupply
      ? 'High - automate qualification, matching, coordination, and last-mile execution around existing supply.'
      : 'High - build an AI Agent to cover intake, analysis, execution, and delivery while supply is validated.';
  }
  if (feasibility >= 70) {
    if (locale === 'zh-CN') {
      return hasVisibleSupply
        ? '中：AI Agent 可做需求确认和流程辅助，履约质量仍需要人工复核。'
        : '中：AI Agent 可覆盖结构化流程，但履约假设需要人工验证。';
    }
    return hasVisibleSupply
      ? 'Medium - use an AI Agent for qualification and workflow assistance, with manual review for fulfillment quality.'
      : 'Medium - AI Agent can cover structured workflow steps, but fulfillment assumptions need manual validation.';
  }
  if (locale === 'zh-CN') {
    return '低：可能依赖非 AI 供给、监管履约或更深的运营验证，暂不适合直接撮合。';
  }
  return 'Low - demand may require non-AI supply, regulated fulfillment, or deeper operational validation before matching.';
}
