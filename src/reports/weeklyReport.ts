import type { Demand, MarketEvidence, ReportArtifact, Score } from '../pipeline/types.js';
import type { RenderedMarkdown } from './miniBrief.js';

export interface WeeklyReportInput {
  periodStart: string;
  periodEnd: string;
  scores: Score[];
  demands: Demand[];
  evidence: MarketEvidence[];
  dailyReports: ReportArtifact[];
}

export function generateWeeklyReport(input: WeeklyReportInput): RenderedMarkdown {
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
  const markdown = `# DemandRadar Weekly - ${input.periodStart} to ${input.periodEnd}

## Deduplicated Opportunities

${opportunities || '- No scored opportunities found'}

## Daily Inputs

${dailyInputs || '- No daily report artifacts found'}

## Source URLs

${sources || '- No source URLs'}
`;
  return {
    path: `reports/weekly/${input.periodStart}_to_${input.periodEnd}.en.md`,
    markdown,
    title: `DemandRadar Weekly - ${input.periodStart} to ${input.periodEnd}`
  };
}

function normalizeDemand(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
