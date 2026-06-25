import type { Demand, MarketEvidence, Score, Source } from '../pipeline/types.js';
import { analyzeSupplyFit } from './supplyAnalysis.js';

export interface DailyReportInput {
  date: string;
  scores: Score[];
  demands: Demand[];
  sources?: Source[];
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
    if (!demand) {
      return `| ${index + 1} | ${score.demand_id} | ${score.total_score}/100 | Demand record missing | Unknown | Cannot match without demand record |`;
    }
    const supply = analyzeSupplyFit({
      demand,
      evidence: input.evidence.filter((item) => item.demand_id === demand.id),
      score
    });
    return `| ${index + 1} | ${escapeTableCell(demand.demand_statement)} | ${score.total_score}/100 | ${escapeTableCell(supply.existingSupply)} | ${escapeTableCell(supply.aiAgentFill)} | ${escapeTableCell(supply.transactionPath)} |`;
  }).join('\n');
  const sources = renderSources(input);
  const markdown = `# DemandRadar Daily - ${input.date}

## Report Focus

The report ranks ten demand opportunities and, for each one, states whether existing supply can satisfy the demand, what supply gap remains, and how an AI Agent could fill the gap to enable a transaction.

## Top 10 Demand-Supply Matchups

| Rank | Demand | Score | Existing Supply Fit | AI Agent Fill | Transaction Path |
| --- | --- | --- | --- | --- | --- |
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

function renderSources(input: DailyReportInput): string {
  if (input.sources && input.sources.length > 0) {
    const sourceUrls = new Set(input.sources.map((source) => source.source_url));
    const sourceLines = input.sources.map((source) => {
      const platform = typeof source.raw.platform === 'string' ? source.raw.platform : source.source_name;
      const updatedAt = typeof source.raw.updated_at === 'string' ? source.raw.updated_at : null;
      const freshness = typeof source.raw.freshness_status === 'string' ? source.raw.freshness_status : 'unknown';
      const time = [
        source.published_at ? `published ${source.published_at}` : null,
        updatedAt ? `updated ${updatedAt.slice(0, 10)}` : null,
        `freshness ${freshness}`
      ].filter(Boolean).join(', ');
      return `- [${platform}] ${source.title} (${time}): ${source.source_url}`;
    });
    const evidenceLines = Array.from(new Set(input.evidence.map((item) => item.source_url)))
      .filter((url) => !sourceUrls.has(url))
      .map((url) => `- Evidence: ${url}`);
    return [...sourceLines, ...evidenceLines].join('\n');
  }
  return Array.from(new Set(input.evidence.map((item) => item.source_url))).map((url) => `- ${url}`).join('\n');
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
