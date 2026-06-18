import type { Demand, MarketEvidence, Score } from '../pipeline/types.js';

export interface DailyReportInput {
  date: string;
  scores: Score[];
  demands: Demand[];
  evidence: MarketEvidence[];
  briefPaths: string[];
}

export interface DailyReport {
  path: string;
  markdown: string;
  title: string;
}

export function generateDailyReport(input: DailyReportInput): DailyReport {
  const demandById = new Map(input.demands.map((demand) => [demand.id, demand]));
  const top10 = input.scores.slice(0, 10);
  const ranking = top10.map((score, index) => {
    const demand = demandById.get(score.demand_id);
    return `${index + 1}. ${demand?.demand_statement ?? score.demand_id} — ${score.total_score}/100`;
  }).join('\n');
  const sources = Array.from(new Set(input.evidence.map((item) => item.source_url))).map((url) => `- ${url}`).join('\n');
  const markdown = `# DemandRadar Daily - ${input.date}

## Top 10

${ranking}

## Top 3 Mini Briefs

${input.briefPaths.slice(0, 3).map((path) => `- ${path}`).join('\n')}

## Source URLs

${sources || '- No source URLs'}
`;
  return {
    path: `reports/${input.date}.md`,
    markdown,
    title: `DemandRadar Daily - ${input.date}`
  };
}
