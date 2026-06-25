import type { Demand, MarketEvidence, ReportArtifact, ReportLocale, Score } from '../pipeline/types.js';
import type { RenderedMarkdown } from './miniBrief.js';

export interface WeeklyReportInput {
  periodStart: string;
  periodEnd: string;
  scores: Score[];
  demands: Demand[];
  evidence: MarketEvidence[];
  dailyReports: ReportArtifact[];
  locale?: ReportLocale;
}

export function generateWeeklyReport(input: WeeklyReportInput): RenderedMarkdown {
  const locale = input.locale ?? 'en';
  const demandById = new Map(input.demands.map((demand) => [demand.id, demand]));
  const seen = new Set<string>();
  const ranked = input.scores
    .map((score) => ({ score, demand: demandById.get(score.demand_id) }))
    .filter((item): item is { score: Score; demand: Demand } => Boolean(item.demand))
    .filter(({ demand }) => {
      const key = normalizeDemand(demand.demand_statement || demand.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
  const opportunities = ranked.map(({ score, demand }, index) => `${index + 1}. ${demand.demand_statement} - ${score.total_score}/100`).join('\n');
  const dailyInputs = input.dailyReports.map((report) => `- ${report.path}`).join('\n');
  const sources = unique(input.evidence.map((item) => item.source_url)).map((url) => `- ${url}`).join('\n');
  const markdown = locale === 'zh-CN'
    ? `# DemandRadar 周报 - ${input.periodStart} 到 ${input.periodEnd}

## 去重后的机会

${opportunities || '- 暂无已评分机会'}

## 日报输入

${dailyInputs || '- 暂无日报产物'}

## 来源链接

${sources || '- 暂无来源链接'}
`
    : `# DemandRadar Weekly - ${input.periodStart} to ${input.periodEnd}

## Deduplicated Opportunities

${opportunities || '- No scored opportunities found'}

## Daily Inputs

${dailyInputs || '- No daily report artifacts found'}

## Source URLs

${sources || '- No source URLs'}
`;
  return {
    path: locale === 'zh-CN' ? `reports/weekly/${input.periodStart}_to_${input.periodEnd}.zh-CN.md` : `reports/weekly/${input.periodStart}_to_${input.periodEnd}.en.md`,
    markdown,
    title: locale === 'zh-CN' ? `DemandRadar 周报 - ${input.periodStart} 到 ${input.periodEnd}` : `DemandRadar Weekly - ${input.periodStart} to ${input.periodEnd}`
  };
}

function normalizeDemand(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
