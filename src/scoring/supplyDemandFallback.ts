import type { Demand, MarketEvidence, ReportLocale, SupplyDemandAnalysis } from '../pipeline/types.js';
import { analyzeCreatorFit } from './creatorFit.js';

export function fallbackSupplyDemandAnalysis(input: {
  demand: Demand;
  evidence: MarketEvidence[];
  generatedAt: string;
  locale?: ReportLocale;
}): SupplyDemandAnalysis {
  const locale = input.locale ?? 'en';
  const creator = analyzeCreatorFit({ demand: input.demand, evidence: input.evidence, locale });
  const competitorEvidence = input.evidence.filter((item) => item.evidence_type === 'competitor');
  const alternatives = input.demand.current_alternatives.filter((item) => item.trim().length > 0);
  const hasSupply = alternatives.length > 0 || competitorEvidence.length > 0;
  const hasPaymentEvidence = input.evidence.some((item) => item.evidence_type === 'willingness_to_pay')
    || /付费|预算|小偿|会员|paid|budget/i.test([
      input.demand.demand_statement,
      input.demand.pain_point,
      ...input.demand.citations.map((citation) => citation.quote)
    ].join('\n'));

  return {
    id: `supply-analysis-${input.demand.id}`,
    run_id: input.demand.run_id,
    demand_id: input.demand.id,
    creator_capability_fit: {
      status: creator.mode === 'direct' ? 'direct' : creator.mode === 'ai_agent_augmented' ? 'orchestrate' : 'not_fit',
      specific_reason: creatorFitReason(input.demand, creator.mode, locale),
      missing_capability: creatorGaps(input.demand, creator.gaps, locale)
    },
    existing_supply_fit: {
      status: hasSupply ? 'partial' : 'unknown',
      matched_supply: hasSupply
        ? [...alternatives, ...competitorEvidence.map((item) => item.value)].slice(0, 3).join(locale === 'zh-CN' ? '；' : '; ')
        : locale === 'zh-CN' ? '本次样本未提供可验证供给' : 'No verified supply in this sample',
      unresolved_gap: hasSupply
        ? locale === 'zh-CN' ? `仍需验证现有供给是否解决：${input.demand.pain_point}` : `Validate whether visible supply resolves: ${input.demand.pain_point}`
        : locale === 'zh-CN' ? `缺少可直接满足该痛点的来源证据：${input.demand.pain_point}` : `Missing source-backed supply for: ${input.demand.pain_point}`
    },
    ai_agent_fill: {
      feasibility: creator.mode === 'third_party' ? 'low' : creator.mode === 'ai_agent_augmented' ? 'medium' : 'high',
      can_do: agentCanDo(input.demand, locale),
      cannot_do: agentCannotDo(input.demand, creator.mode, locale),
      required_inputs: locale === 'zh-CN' ? ['更具体的用户约束', '可验证供给证据'] : ['Specific user constraints', 'Verified supply evidence']
    },
    third_party_supply_path: {
      needed: creator.mode === 'third_party',
      provider_type: thirdPartyProvider(input.demand, creator.mode, locale),
      why: thirdPartyReason(input.demand, creator.mode, locale),
      handoff_boundary: handoffBoundary(input.demand, creator.mode, locale)
    },
    scoring_assessment: {
      demand_strength: input.demand.confidence >= 0.8 ? 'high' : input.demand.confidence >= 0.55 ? 'medium' : 'low',
      supply_gap: hasSupply ? 'clear' : 'unknown',
      agent_feasibility: creator.mode === 'third_party' ? 'low' : creator.mode === 'ai_agent_augmented' ? 'medium' : 'high',
      payment_signal: hasPaymentEvidence ? 'explicit' : input.evidence.some((item) => item.evidence_type === 'competitor') ? 'inferred' : 'weak',
      evidence_quality: input.demand.citations.length >= 2 || input.evidence.length >= 2 ? 'medium' : 'weak'
    },
    confidence: Math.max(0.35, Math.min(0.8, input.demand.confidence * 0.75)),
    generated_at: input.generatedAt
  };
}

function creatorFitReason(demand: Demand, mode: ReturnType<typeof analyzeCreatorFit>['mode'], locale: ReportLocale): string {
  if (locale === 'zh-CN') {
    if (mode === 'direct') return `个人可先围绕“${shortText(demand.demand_statement)}”做可验证原型或服务流程，重点验证用户约束、输入材料和交付标准是否清晰。`;
    if (mode === 'ai_agent_augmented') return `个人更适合负责“${shortText(demand.demand_statement)}”的产品化、需求判断和流程编排，批量执行部分需要 Agent 承接。`;
    return `不建议个人直接承诺完整履约；该需求的核心痛点是“${shortText(demand.pain_point)}”，需要先确认外部专业供给或履约资质。`;
  }
  if (mode === 'direct') return `The creator can start with a testable prototype or service workflow for "${shortText(demand.demand_statement)}", validating constraints, inputs, and delivery standards.`;
  if (mode === 'ai_agent_augmented') return `The creator is better suited to productize and orchestrate "${shortText(demand.demand_statement)}", with repetitive execution delegated to an Agent.`;
  return `Do not promise full fulfillment directly; the core pain is "${shortText(demand.pain_point)}" and needs external specialist supply or credentials first.`;
}

function creatorGaps(demand: Demand, defaultGaps: string[], locale: ReportLocale): string[] {
  const gaps = [
    locale === 'zh-CN' ? `验证“${shortText(demand.pain_point)}”是否是高频付费痛点` : `Validate whether "${shortText(demand.pain_point)}" is a frequent paid pain`,
    locale === 'zh-CN' ? '明确最小交付物和验收标准' : 'Define the smallest deliverable and acceptance criteria'
  ];
  return defaultGaps.length > 0 ? Array.from(new Set([...gaps, ...defaultGaps.slice(0, 1)])) : gaps;
}

function agentCanDo(demand: Demand, locale: ReportLocale): string[] {
  const text = searchableDemandText(demand);
  if (/pdf|文件|上传|公文|写作|文章/i.test(text)) {
    return locale === 'zh-CN'
      ? ['解析上传文件和用户要求', '检索补充资料', '生成初稿并按模板复核格式']
      : ['Parse uploaded files and user requirements', 'Retrieve supporting material', 'Draft and check formatting against templates'];
  }
  if (/ppt|演示|slide/i.test(text)) {
    return locale === 'zh-CN'
      ? ['把文字稿拆成页面结构', '匹配模板和版式', '生成可修改的演示初稿']
      : ['Turn text into slide structure', 'Match templates and layouts', 'Generate an editable presentation draft'];
  }
  if (/简历|求职|面试|hr|招聘/i.test(text)) {
    return locale === 'zh-CN'
      ? ['提取岗位要求和简历要点', '指出匹配缺口', '生成修改建议和面试追问']
      : ['Extract job requirements and resume facts', 'Identify match gaps', 'Generate revision advice and interview questions'];
  }
  return locale === 'zh-CN'
    ? ['整理用户输入和来源证据', '比较现有替代方案', '生成可人工复核的交付草稿']
    : ['Organize user input and source evidence', 'Compare visible alternatives', 'Generate a human-reviewable draft'];
}

function agentCannotDo(demand: Demand, mode: ReturnType<typeof analyzeCreatorFit>['mode'], locale: ReportLocale): string[] {
  const common = locale === 'zh-CN'
    ? ['替代用户或专家做最终质量判断', '保证来源外事实完全正确']
    : ['Replace final user or expert judgment', 'Guarantee facts beyond the provided sources'];
  if (mode === 'third_party') {
    return locale === 'zh-CN'
      ? [...common, `独立完成“${shortText(demand.pain_point)}”涉及的专业履约`]
      : [...common, `Independently fulfill specialist work around "${shortText(demand.pain_point)}"`];
  }
  return common;
}

function thirdPartyProvider(demand: Demand, mode: ReturnType<typeof analyzeCreatorFit>['mode'], locale: ReportLocale): string {
  const text = searchableDemandText(demand);
  if (/pdf|搜索|api|模型|公文|写作/i.test(text)) return locale === 'zh-CN' ? '模型/API、文档解析或检索服务提供方' : 'model/API, document parsing, or retrieval provider';
  if (/ppt|设计|模板/i.test(text)) return locale === 'zh-CN' ? 'PPT 模板库、设计资源或办公套件 API' : 'presentation template, design asset, or office-suite API provider';
  if (/简历|求职|面试|hr|招聘/i.test(text)) return locale === 'zh-CN' ? 'HR、行业面试官或求职辅导服务商' : 'HR reviewer, industry interviewer, or career coach';
  if (mode === 'third_party') return locale === 'zh-CN' ? '具备专业履约能力的外部服务商' : 'external provider with specialist fulfillment capability';
  return locale === 'zh-CN' ? '暂不需要固定第三方，先验证最小交付' : 'No fixed third party yet; validate the smallest deliverable first';
}

function thirdPartyReason(demand: Demand, mode: ReturnType<typeof analyzeCreatorFit>['mode'], locale: ReportLocale): string {
  if (mode === 'third_party') {
    return locale === 'zh-CN'
      ? `该需求的关键风险不在信息整理，而在“${shortText(demand.pain_point)}”能否被专业、合规或稳定履约。`
      : `The key risk is not information organization but whether "${shortText(demand.pain_point)}" can be fulfilled professionally, compliantly, or reliably.`;
  }
  return locale === 'zh-CN'
    ? `第三方只在个人/Agent 无法覆盖模型能力、数据来源、模板资产或专业背书时补位。`
    : 'Use third parties only where creator/Agent cannot cover model capability, data sources, template assets, or specialist credibility.';
}

function handoffBoundary(demand: Demand, mode: ReturnType<typeof analyzeCreatorFit>['mode'], locale: ReportLocale): string {
  if (mode === 'third_party') {
    return locale === 'zh-CN'
      ? `个人/Agent 完成需求澄清和资料准备后，把核心履约交给第三方。`
      : 'After creator/Agent clarifies requirements and prepares materials, hand core fulfillment to the third party.';
  }
  return locale === 'zh-CN'
    ? `当原型验证显示需要外部数据、模板、API 或专家复核时再交接。`
    : 'Hand off only when validation shows a need for external data, templates, APIs, or expert review.';
}

function searchableDemandText(demand: Demand): string {
  return [
    demand.user_profile,
    demand.pain_point,
    demand.demand_statement,
    ...demand.current_alternatives,
    ...demand.citations.map((citation) => citation.quote)
  ].join('\n');
}

function shortText(value: string): string {
  return value.length > 80 ? `${value.slice(0, 80)}...` : value;
}
