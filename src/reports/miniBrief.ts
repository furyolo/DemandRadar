import type { Demand, MarketEvidence, ReportLocale, Score } from '../pipeline/types.js';
import { analyzeSupplyFit } from './supplyAnalysis.js';

export interface MiniBriefInput {
  date: string;
  demand: Demand;
  evidence: MarketEvidence[];
  score: Score;
  locale?: ReportLocale;
}

export interface RenderedMarkdown {
  path: string;
  markdown: string;
  title: string;
}

export function generateMiniBrief(input: MiniBriefInput): RenderedMarkdown {
  const locale = input.locale ?? 'en';
  const slug = slugify(input.demand.demand_statement, input.demand.id);
  const path = locale === 'zh-CN' ? `briefs/${input.date}/${slug}.zh-CN.md` : `briefs/${input.date}/${slug}.md`;
  const evidenceLines = input.evidence.map((item) => `- ${item.evidence_type}: ${item.value} (${item.source_url})`).join('\n');
  const supply = analyzeSupplyFit({ ...input, locale });
  const markdown = locale === 'zh-CN'
    ? `# ${input.demand.demand_statement}

## 目标用户

${input.demand.user_profile}

## 痛点

${input.demand.pain_point}

## MVP 功能

- 捕获相关需求信号
- 保留有来源支撑的证据
- 对机会质量排序

## 供给侧匹配

- 现有供给：${supply.existingSupply}
- 供给缺口：${supply.supplyGap}
- AI Agent 补足：${supply.aiAgentFill}
- 交易路径：${supply.transactionPath}

## 市场证据

${evidenceLines || '- 暂无市场证据'}

## 分数

${input.score.total_score}/100 - ${input.score.explanation}

## 风险

- 证据置信度：${input.score.confidence.toFixed(2)}
- 正式使用前需要复核来源覆盖
`
    : `# ${input.demand.demand_statement}

## Target User

${input.demand.user_profile}

## Pain Point

${input.demand.pain_point}

## MVP Features

- Capture related demand signals
- Preserve source-backed evidence
- Rank opportunity quality

## Supply-Side Fit

- Existing supply: ${supply.existingSupply}
- Supply gap: ${supply.supplyGap}
- AI Agent fill: ${supply.aiAgentFill}
- Transaction path: ${supply.transactionPath}

## Market Evidence

${evidenceLines || '- No market evidence available'}

## Score

${input.score.total_score}/100 — ${input.score.explanation}

## Risks

- Evidence confidence: ${input.score.confidence.toFixed(2)}
- Source coverage must be reviewed before live use
`;
  return { path, markdown, title: input.demand.demand_statement };
}

function slugify(value: string, fallback: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || fallback;
}
