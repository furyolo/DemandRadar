import type { Demand, MarketEvidence, ReportLocale, Score, Source, SupplyDemandAnalysis } from '../pipeline/types.js';
import { analyzeSupplyFit } from './supplyAnalysis.js';

export interface DailyReportInput {
  date: string;
  scores: Score[];
  demands: Demand[];
  sources?: Source[];
  evidence: MarketEvidence[];
  supplyAnalyses?: SupplyDemandAnalysis[];
  briefPaths: string[];
  locale?: ReportLocale;
}

export interface DailyReport {
  path: string;
  markdown: string;
  title: string;
}

export function generateDailyReport(input: DailyReportInput): DailyReport {
  const locale = input.locale ?? 'en';
  const demandById = new Map(input.demands.map((demand) => [demand.id, demand]));
  const analysisByDemandId = new Map((input.supplyAnalyses ?? []).map((analysis) => [analysis.demand_id, analysis]));
  const top10 = input.scores.slice(0, 10);
  const ranking = top10.map((score, index) => {
    const demand = demandById.get(score.demand_id);
    if (!demand) {
      return locale === 'zh-CN'
        ? `| ${index + 1} | ${score.demand_id} | ${score.total_score}/100 | 缺少需求记录 | 未知 | 未知 | 无法匹配，因为缺少需求记录 |`
        : `| ${index + 1} | ${score.demand_id} | ${score.total_score}/100 | Demand record missing | Unknown | Unknown | Cannot match without demand record |`;
    }
    const supply = analyzeSupplyFit({
      demand,
      evidence: input.evidence.filter((item) => item.demand_id === demand.id),
      score,
      analysis: analysisByDemandId.get(demand.id),
      locale
    });
    return `| ${index + 1} | ${escapeTableCell(demand.demand_statement)} | ${score.total_score}/100 | ${escapeTableCell(supply.creatorFit)} | ${escapeTableCell(supply.existingSupply)} | ${escapeTableCell(supply.aiAgentFill)} | ${escapeTableCell(supply.thirdPartyPath)} |`;
  }).join('\n');
  const sources = renderSources(input, locale);
  const markdown = locale === 'zh-CN'
    ? `# DemandRadar 每日报告 - ${input.date}

## 报告重点

本报告呈现 10 条需求机会，并逐条说明个人能力是否能直接满足、AI Agent 能否短期补足、以及何时需要第三方供给。

## 需求-供给匹配前十

| 排名 | 需求 | 分数 | 个人能力匹配 | 现有供给匹配 | AI Agent 补足 | 第三方供给路径 |
| --- | --- | --- | --- | --- | --- | --- |
${ranking}

## Top 3 精简 Brief

${input.briefPaths.slice(0, 3).map((path) => `- ${path}`).join('\n')}

## 来源链接

${sources || '- 暂无来源链接'}
`
    : `# DemandRadar Daily - ${input.date}

## Report Focus

The report ranks ten demand opportunities and states whether creator capability can satisfy the demand directly, whether an AI Agent can fill the short-term gap, and when third-party supply is needed.

## Top 10 Demand-Supply Matchups

| Rank | Demand | Score | Creator Capability Fit | Existing Supply Fit | AI Agent Fill | Third-Party Supply Path |
| --- | --- | --- | --- | --- | --- | --- |
${ranking}

## Top 3 Mini Briefs

${input.briefPaths.slice(0, 3).map((path) => `- ${path}`).join('\n')}

## Source URLs

${sources || '- No source URLs'}
`;
  return {
    path: locale === 'zh-CN' ? `reports/${input.date}.zh-CN.md` : `reports/${input.date}.md`,
    markdown,
    title: locale === 'zh-CN' ? `DemandRadar 每日报告 - ${input.date}` : `DemandRadar Daily - ${input.date}`
  };
}

function renderSources(input: DailyReportInput, locale: ReportLocale): string {
  if (input.sources && input.sources.length > 0) {
    const sourceUrls = new Set(input.sources.map((source) => source.source_url));
    const sourceLines = input.sources.map((source) => {
      const platform = typeof source.raw.platform === 'string' ? source.raw.platform : source.source_name;
      const updatedAt = typeof source.raw.updated_at === 'string' ? source.raw.updated_at : null;
      const freshness = typeof source.raw.freshness_status === 'string' ? source.raw.freshness_status : 'unknown';
      const time = [
        source.published_at ? `${locale === 'zh-CN' ? '发布' : 'published'} ${source.published_at}` : null,
        updatedAt ? `${locale === 'zh-CN' ? '更新' : 'updated'} ${updatedAt.slice(0, 10)}` : null,
        `${locale === 'zh-CN' ? '时效' : 'freshness'} ${freshnessLabel(freshness, locale)}`
      ].filter(Boolean).join(', ');
      return `- [${platform}] ${source.title} (${time}): ${source.source_url}`;
    });
    const evidenceLines = Array.from(new Set(input.evidence.map((item) => item.source_url)))
      .filter((url) => !sourceUrls.has(url))
      .map((url) => `- ${locale === 'zh-CN' ? '证据' : 'Evidence'}: ${url}`);
    return [...sourceLines, ...evidenceLines].join('\n');
  }
  return Array.from(new Set(input.evidence.map((item) => item.source_url))).map((url) => `- ${url}`).join('\n');
}

function freshnessLabel(freshness: string, locale: ReportLocale): string {
  if (locale !== 'zh-CN') return freshness;
  switch (freshness) {
    case 'fresh':
      return '新鲜';
    case 'recent':
      return '近期';
    case 'stale':
      return '偏旧';
    case 'expired':
      return '过期';
    case 'unknown':
      return '未知';
    default:
      return freshness;
  }
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
