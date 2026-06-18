import type { Demand, MarketEvidence, Score } from '../pipeline/types.js';

export interface MiniBriefInput {
  date: string;
  demand: Demand;
  evidence: MarketEvidence[];
  score: Score;
}

export interface RenderedMarkdown {
  path: string;
  markdown: string;
  title: string;
}

export function generateMiniBrief(input: MiniBriefInput): RenderedMarkdown {
  const slug = slugify(input.demand.demand_statement);
  const path = `briefs/${input.date}/${slug}.md`;
  const evidenceLines = input.evidence.map((item) => `- ${item.evidence_type}: ${item.value} (${item.source_url})`).join('\n');
  const markdown = `# ${input.demand.demand_statement}

## Target User

${input.demand.user_profile}

## Pain Point

${input.demand.pain_point}

## MVP Features

- Capture related demand signals
- Preserve source-backed evidence
- Rank opportunity quality

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

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'brief';
}
