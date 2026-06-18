import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/storage/database.js';
import { DemandRadarRepository } from '../src/storage/repositories.js';
import type { PipelineResult } from '../src/pipeline/types.js';

const now = '2026-06-18T00:00:00.000Z';

function fixtureResult(): PipelineResult {
  return {
    run: {
      id: 'run-1',
      started_at: now,
      completed_at: now,
      status: 'completed',
      query_window_days: 30,
      top_hotspot_limit: 100,
      metadata: { fixture: true }
    },
    sources: [{
      id: 'source-1',
      run_id: 'run-1',
      source_url: 'https://example.com/story',
      title: 'Story',
      snippet: 'A product demand signal',
      source_name: 'Example',
      published_at: null,
      search_query: 'startup demand',
      time_window: '30d',
      raw: { score: 1 }
    }],
    hotspots: [{
      id: 'hotspot-1',
      run_id: 'run-1',
      title: 'Story',
      summary: 'A product demand signal',
      domain: 'technology',
      source_ids: ['source-1'],
      canonical_url: 'https://example.com/story',
      heat_score: 80,
      search_query: 'startup demand',
      time_window: '30d',
      generated_at: now
    }],
    demands: [{
      id: 'demand-1',
      run_id: 'run-1',
      hotspot_id: 'hotspot-1',
      user_profile: 'Indie hacker',
      pain_point: 'Hard to find validated product ideas',
      current_alternatives: ['Manual research'],
      demand_statement: 'Find validated product opportunities faster',
      citations: [{ source_url: 'https://example.com/story', quote: 'demand signal' }],
      confidence: 0.8,
      generated_at: now
    }],
    market_evidence: [{
      id: 'evidence-1',
      run_id: 'run-1',
      demand_id: 'demand-1',
      evidence_type: 'tam',
      value: 'large',
      source_url: 'https://example.com/report',
      search_query: 'market size',
      time_window: '30d',
      confidence: 0.7,
      generated_at: now
    }],
    scores: [{
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
      explanation: 'Strong demand and feasible MVP',
      confidence: 0.75,
      generated_at: now
    }],
    reports: [{
      id: 'report-1',
      run_id: 'run-1',
      report_type: 'daily',
      demand_id: null,
      path: 'reports/2026-06-18.md',
      title: 'DemandRadar Daily',
      generated_at: now
    }]
  };
}

describe('DemandRadarRepository', () => {
  it('migrates and round-trips a minimal pipeline result', () => {
    const db = openDatabase(':memory:');
    const repository = new DemandRadarRepository(db);

    repository.savePipelineResult(fixtureResult());

    expect(repository.listTopScores('run-1', 10)).toHaveLength(1);
    expect(repository.getDemandDetail('demand-1')?.citations[0]?.source_url).toBe('https://example.com/story');
    expect(repository.getRunSummary('run-1')).toMatchObject({
      report_count: 1,
      demand_count: 1
    });
    expect(repository.findReportArtifact({
      cadence: 'daily',
      locale: 'en',
      periodStart: '2026-06-18',
      periodEnd: '2026-06-18'
    })?.path).toBe('reports/2026-06-18.md');

    db.close();
  });

  it('finds localized and windowed report artifacts through repository APIs', () => {
    const db = openDatabase(':memory:');
    const repository = new DemandRadarRepository(db);
    const baseReport = fixtureResult().reports[0];
    if (!baseReport) throw new Error('Missing fixture report');
    repository.savePipelineResult({
      ...fixtureResult(),
      reports: [
        {
          ...baseReport,
          cadence: 'daily',
          locale: 'en',
          canonical_report_id: null,
          period_start: '2026-06-18',
          period_end: '2026-06-18',
          metadata: {}
        },
        {
          id: 'report-zh',
          run_id: 'run-1',
          report_type: 'daily',
          demand_id: null,
          cadence: 'daily',
          locale: 'zh-CN',
          canonical_report_id: 'report-1',
          period_start: '2026-06-18',
          period_end: '2026-06-18',
          path: 'reports/2026-06-18.zh-CN.md',
          title: 'DemandRadar Daily (zh-CN)',
          generated_at: now,
          metadata: {}
        }
      ]
    });

    expect(repository.findReportArtifact({ cadence: 'daily', locale: 'zh-CN', periodStart: '2026-06-18', periodEnd: '2026-06-18' })?.canonical_report_id).toBe('report-1');
    expect(repository.listReportArtifactsForWindow({ cadence: 'daily', locale: 'en', periodStart: '2026-06-18', periodEnd: '2026-06-18' })).toHaveLength(1);
    expect(repository.listScoresForRuns(['run-1'])).toHaveLength(1);
    expect(repository.listEvidenceForRun('run-1')).toHaveLength(1);

    db.close();
  });

  it('keeps database access behind ORM-backed storage APIs', async () => {
    const files = await sourceFiles(['src', 'scripts']);
    const offenders: string[] = [];
    const forbidden = '.pre' + 'pare(';

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      if (content.includes(forbidden)) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });
});

async function sourceFiles(paths: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const path of paths) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const fullPath = join(path, entry.name);
      if (entry.isDirectory()) {
        files.push(...await sourceFiles([fullPath]));
      } else if (/\.(ts|tsx|js)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}
