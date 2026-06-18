import { describe, expect, it } from 'vitest';
import { generateDailyReport } from '../src/reports/dailyReport.js';
import { generateMiniBrief } from '../src/reports/miniBrief.js';
import { generateMonthlyReport } from '../src/reports/monthlyReport.js';
import { translateMarkdownReport } from '../src/reports/translateReport.js';
import { generateWeeklyReport } from '../src/reports/weeklyReport.js';
import type { Demand, MarketEvidence, ReportArtifact, Score } from '../src/pipeline/types.js';

const now = '2026-06-18T00:00:00.000Z';

describe('reports', () => {
  it('renders Mini Brief and daily report with deterministic paths and source URLs', () => {
    const demand = fixtureDemand();
    const evidence = [fixtureEvidence()];
    const score = fixtureScore();
    const brief = generateMiniBrief({ date: '2026-06-18', demand, evidence, score });
    const daily = generateDailyReport({
      date: '2026-06-18',
      scores: [score],
      demands: [demand],
      evidence,
      briefPaths: [brief.path]
    });

    expect(brief.path).toContain('briefs/2026-06-18/');
    expect(brief.markdown).toContain('https://example.com/report');
    expect(daily.path).toBe('reports/2026-06-18.md');
    expect(daily.markdown).toContain('## Top 10');
    expect(daily.markdown).toContain('## Top 3 Mini Briefs');
    expect(daily.markdown).toContain('https://example.com/report');
  });

  it('uses demand id when Mini Brief title has no ASCII slug', () => {
    const demand = {
      ...fixtureDemand(),
      id: 'demand-cn-1',
      demand_statement: '需要一款自动跨平台痛点挖掘工具'
    };
    const brief = generateMiniBrief({
      date: '2026-06-18',
      demand,
      evidence: [fixtureEvidence()],
      score: fixtureScore()
    });

    expect(brief.path).toBe('briefs/2026-06-18/demand-cn-1.md');
  });

  it('renders weekly and monthly rollups with deterministic sections', () => {
    const demand = fixtureDemand();
    const evidence = [fixtureEvidence()];
    const score = fixtureScore();
    const dailyReport = fixtureReport();
    const weekly = generateWeeklyReport({
      periodStart: '2026-06-12',
      periodEnd: '2026-06-18',
      scores: [score, { ...score, id: 'score-2' }],
      demands: [demand],
      evidence,
      dailyReports: [dailyReport]
    });
    const monthly = generateMonthlyReport({
      month: '2026-06',
      weeklyReports: [{ ...dailyReport, report_type: 'weekly', cadence: 'weekly', title: weekly.title, path: weekly.path }]
    });

    expect(weekly.path).toBe('reports/weekly/2026-06-12_to_2026-06-18.en.md');
    expect(weekly.markdown).toContain('## Deduplicated Opportunities');
    expect(weekly.markdown).toContain('https://example.com/report');
    expect(monthly.path).toBe('reports/monthly/2026-06.en.md');
    expect(monthly.markdown).toContain('## Recurring Themes');
    expect(monthly.markdown).toContain('## Investment-Worthy Directions');
  });

  it('preserves product names and keeps source quotes in translation prompts', async () => {
    const messages: unknown[] = [];
    const translated = await translateMarkdownReport({
      title: 'DemandRadar Daily',
      markdown: '# Cursor API\n\n> manual research\n\nhttps://example.com/report',
      terms: ['Cursor', 'API', 'GPT-4'],
      llm: {
        async generateText(input) {
          messages.push(...input);
          return '# Cursor API\n\n> manual research\n\nhttps://example.com/report';
        }
      }
    });

    const serialized = JSON.stringify(messages);
    expect(serialized).toContain('Preserve URLs');
    expect(serialized).toContain('product names');
    expect(serialized).toContain('code identifiers');
    expect(translated).toContain('https://example.com/report');
    expect(translated).toContain('manual research');
  });
});

function fixtureDemand(): Demand {
  return {
    id: 'demand-1',
    run_id: 'run-1',
    hotspot_id: 'hotspot-1',
    user_profile: 'Builder',
    pain_point: 'Research is slow',
    current_alternatives: ['manual'],
    demand_statement: 'Automate opportunity research',
    citations: [{ source_url: 'https://example.com/story', quote: 'manual research' }],
    confidence: 0.8,
    generated_at: now
  };
}

function fixtureEvidence(): MarketEvidence {
  return {
    id: 'evidence-1',
    run_id: 'run-1',
    demand_id: 'demand-1',
    evidence_type: 'tam',
    value: 'large',
    source_url: 'https://example.com/report',
    search_query: 'market',
    time_window: '30d',
    confidence: 0.7,
    generated_at: now
  };
}

function fixtureScore(): Score {
  return {
    id: 'score-1',
    run_id: 'run-1',
    demand_id: 'demand-1',
    dimension_scores: {
      demand_strength: 80,
      market_size: 70,
      willingness_to_pay: 60,
      feasibility: 90
    },
    total_score: 75,
    explanation: 'source-backed',
    confidence: 0.8,
    generated_at: now
  };
}

function fixtureReport(): ReportArtifact {
  return {
    id: 'report-1',
    run_id: 'run-1',
    report_type: 'daily',
    demand_id: null,
    cadence: 'daily',
    locale: 'en',
    canonical_report_id: null,
    period_start: '2026-06-18',
    period_end: '2026-06-18',
    path: 'reports/2026-06-18.md',
    title: 'DemandRadar Daily',
    generated_at: now,
    metadata: {}
  };
}
