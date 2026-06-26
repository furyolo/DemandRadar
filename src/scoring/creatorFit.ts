import type { Demand, MarketEvidence, ReportLocale } from '../pipeline/types.js';

export type CreatorFulfillmentMode = 'direct' | 'ai_agent_augmented' | 'third_party';

export interface CreatorFitAnalysis {
  score: number;
  mode: CreatorFulfillmentMode;
  matchedCapabilities: string[];
  gaps: string[];
  personalFit: string;
  aiAgentFit: string;
  thirdPartyPath: string;
}

interface CapabilityRule {
  label: string;
  keywords: string[];
  weight: number;
}

const capabilityRules: CapabilityRule[] = [
  {
    label: 'AI 应用、自动化脚本、API 编排和前后端系统',
    keywords: [
      'ai', 'agent', 'automation', 'automate', 'workflow', 'api', 'cursor', 'claude', 'chatgpt',
      '自动化', '智能体', '工作流', '接口', '脚本', '前端', '后端', '系统', '工具'
    ],
    weight: 28
  },
  {
    label: '数据分析、SQL、广告 ROI、用户行为和预测判断',
    keywords: [
      'data', 'analytics', 'sql', 'roi', 'prediction', 'forecast', 'dashboard', 'metric',
      '数据', '分析', '报表', '指标', '预测', '投放', '广告', '转化', '用户行为'
    ],
    weight: 24
  },
  {
    label: '平台机制、商业撮合、供需匹配和交易路径设计',
    keywords: [
      'marketplace', 'platform', 'matching', 'supply', 'demand', 'transaction', 'vendor',
      '平台', '撮合', '供给', '需求', '交易', '商家', '服务商', '竞品', '替代方案'
    ],
    weight: 20
  },
  {
    label: '游戏、内容平台、增长优化和商业化机制',
    keywords: [
      'game', 'gaming', 'creator', 'content', 'monetization', 'retention',
      '游戏', '内容', '创作者', '留存', '付费', '商业化', '增长'
    ],
    weight: 14
  },
  {
    label: '结构化研究、信息整理、报告和产品原型设计',
    keywords: [
      'research', 'brief', 'report', 'prototype', 'mvp', 'knowledge', 'analysis',
      '研究', '简报', '报告', '原型', '知识库', '调研', '方案'
    ],
    weight: 14
  }
];

const thirdPartySignals = [
  'license', 'licensed', 'regulatory', 'medical', 'doctor', 'legal', 'lawyer', 'accounting',
  'physical', 'onsite', 'warehouse', 'manufacturing', 'logistics', 'delivery', 'hardware',
  '资质', '牌照', '监管', '医疗', '医生', '法律', '律师', '会计', '线下', '上门',
  '仓储', '制造', '物流', '配送', '硬件', '施工'
];

const aiAgentSignals = [
  'intake', 'triage', 'summarize', 'compare', 'generate', 'draft', 'monitor', 'classify',
  'route', 'coordinate', 'research', 'extract', 'workflow',
  '接单', '分诊', '总结', '比较', '生成', '起草', '监控', '分类', '路由', '协调', '调研', '提取', '流程'
];

export function analyzeCreatorFit(input: {
  demand: Demand;
  evidence?: MarketEvidence[];
  locale?: ReportLocale;
}): CreatorFitAnalysis {
  const locale = input.locale ?? 'en';
  const text = searchableText(input.demand, input.evidence ?? []);
  const matched = capabilityRules
    .map((rule) => ({ rule, hits: rule.keywords.filter((keyword) => includesKeyword(text, keyword)) }))
    .filter((item) => item.hits.length > 0);
  const matchedCapabilities = matched.map((item) => item.rule.label);
  const capabilityScore = Math.min(86, 34 + matched.reduce((sum, item) => sum + item.rule.weight, 0));
  const hasThirdPartySignal = thirdPartySignals.some((keyword) => includesKeyword(text, keyword));
  const hasAgentSignal = aiAgentSignals.some((keyword) => includesKeyword(text, keyword));
  const score = clamp(hasThirdPartySignal ? capabilityScore - 24 : capabilityScore + (hasAgentSignal ? 6 : 0));
  const mode = fulfillmentMode(score, hasThirdPartySignal, matched.length);
  const gaps = capabilityGaps(mode, matchedCapabilities, hasThirdPartySignal, locale);

  return {
    score,
    mode,
    matchedCapabilities,
    gaps,
    personalFit: formatPersonalFit(mode, score, matchedCapabilities, locale),
    aiAgentFit: formatAiAgentFit(mode, score, hasAgentSignal, locale),
    thirdPartyPath: formatThirdPartyPath(mode, hasThirdPartySignal, locale)
  };
}

function searchableText(demand: Demand, evidence: MarketEvidence[]): string {
  return [
    demand.user_profile,
    demand.pain_point,
    demand.demand_statement,
    ...demand.current_alternatives,
    ...demand.citations.map((citation) => citation.quote),
    ...evidence.map((item) => item.value)
  ].join('\n').toLowerCase();
}

function includesKeyword(text: string, keyword: string): boolean {
  return text.includes(keyword.toLowerCase());
}

function fulfillmentMode(score: number, hasThirdPartySignal: boolean, matchedCount: number): CreatorFulfillmentMode {
  if (hasThirdPartySignal && score < 72) return 'third_party';
  if (score >= 74 && matchedCount >= 2) return 'direct';
  if (score >= 58) return 'ai_agent_augmented';
  return 'third_party';
}

function capabilityGaps(
  mode: CreatorFulfillmentMode,
  matchedCapabilities: string[],
  hasThirdPartySignal: boolean,
  locale: ReportLocale
): string[] {
  if (mode === 'direct') {
    return locale === 'zh-CN'
      ? ['仍需验证真实用户愿付费、来源覆盖和最小交付边界']
      : ['Validate willingness to pay, source coverage, and the smallest deliverable scope'];
  }
  if (mode === 'ai_agent_augmented') {
    return locale === 'zh-CN'
      ? ['需要用 AI Agent 补足执行容量、批量处理和交付稳定性']
      : ['Use an AI Agent to add execution capacity, batch handling, and delivery consistency'];
  }
  if (hasThirdPartySignal) {
    return locale === 'zh-CN'
      ? ['可能涉及牌照、线下履约、硬件或专业责任，需要第三方供给']
      : ['Likely needs licensed, physical, hardware, or professionally liable supply'];
  }
  return matchedCapabilities.length === 0
    ? locale === 'zh-CN'
      ? ['未命中当前个人能力画像中的核心能力，需要寻找外部供给']
      : ['No strong match with the current creator capability profile; seek external supply']
    : locale === 'zh-CN'
      ? ['只命中部分能力，交付前需要外部专业能力或服务商验证']
      : ['Only partial capability match; validate external expertise or providers before fulfillment'];
}

function formatPersonalFit(
  mode: CreatorFulfillmentMode,
  score: number,
  matchedCapabilities: string[],
  locale: ReportLocale
): string {
  const capability = matchedCapabilities.slice(0, 2).join(locale === 'zh-CN' ? '、' : ', ');
  if (locale === 'zh-CN') {
    if (mode === 'direct') return `高（${score}/100）：可由个人能力直接切入，匹配 ${capability || '应用技术与系统化交付'}。`;
    if (mode === 'ai_agent_augmented') return `中（${score}/100）：个人可负责产品化、判断和编排，需 AI Agent 扩展执行能力。`;
    return `低（${score}/100）：不建议仅靠个人能力履约，应优先找外部供给或专业服务商。`;
  }
  if (mode === 'direct') return `High (${score}/100) - the creator can directly pursue this via ${capability || 'applied technology and systems delivery'}.`;
  if (mode === 'ai_agent_augmented') return `Medium (${score}/100) - the creator can own productization, judgment, and orchestration with AI Agent execution support.`;
  return `Low (${score}/100) - do not fulfill with creator capability alone; prioritize external supply or specialist providers.`;
}

function formatAiAgentFit(
  mode: CreatorFulfillmentMode,
  score: number,
  hasAgentSignal: boolean,
  locale: ReportLocale
): string {
  if (locale === 'zh-CN') {
    if (mode === 'direct') return '可作为放大器：用于线索采集、结构化分析、原型生成和交付复核。';
    if (mode === 'ai_agent_augmented') return hasAgentSignal
      ? '可短期补足：需求确认、资料整理、比较、生成和流程协调适合 Agent 化。'
      : '可尝试补足：先把流程拆成可验证步骤，再用 Agent 承接重复执行。';
    return score >= 50
      ? '只能辅助前置环节：可做获客、分诊和资料准备，核心履约仍要第三方。'
      : '不宜作为主要供给：只能做线索整理或转介辅助。';
  }
  if (mode === 'direct') return 'Useful as leverage for lead capture, structured analysis, prototype generation, and delivery review.';
  if (mode === 'ai_agent_augmented') return hasAgentSignal
    ? 'Can fill the short-term gap: qualification, research, comparison, generation, and workflow coordination are agent-friendly.'
    : 'Can be tested after decomposing fulfillment into verifiable workflow steps.';
  return score >= 50
    ? 'Useful only for intake, triage, and preparation; core fulfillment still needs third-party supply.'
    : 'Not suitable as primary supply; use only for lead organization or referral support.';
}

function formatThirdPartyPath(mode: CreatorFulfillmentMode, hasThirdPartySignal: boolean, locale: ReportLocale): string {
  if (locale === 'zh-CN') {
    if (mode === 'direct') return '第三方不是首选；仅在规模化、合规或专业背书不足时补位。';
    if (mode === 'ai_agent_augmented') return '先用个人 + AI Agent 做轻量履约验证，再为不可自动化环节寻找第三方。';
    return hasThirdPartySignal
      ? '优先撮合有资质或线下履约能力的供给方，个人/Agent 负责获客、分诊和交付管理。'
      : '先找可复用的软件、服务商或自由职业供给，个人/Agent 负责需求定义和匹配。';
  }
  if (mode === 'direct') return 'Third parties are not the first path; add them only for scale, compliance, or specialist credibility.';
  if (mode === 'ai_agent_augmented') return 'Validate lightweight fulfillment with creator plus AI Agent, then source third parties for non-automatable steps.';
  return hasThirdPartySignal
    ? 'Prioritize licensed or operational providers while the creator/Agent handles acquisition, triage, and delivery management.'
    : 'Find reusable software, service providers, or freelancers while the creator/Agent handles demand definition and matching.';
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
