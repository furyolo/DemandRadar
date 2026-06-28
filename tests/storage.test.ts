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
    supply_analyses: [{
      id: 'supply-analysis-demand-1',
      run_id: 'run-1',
      demand_id: 'demand-1',
      creator_capability_fit: {
        status: 'direct',
        specific_reason: 'Can build the research workflow MVP directly.',
        missing_capability: []
      },
      existing_supply_fit: {
        status: 'partial',
        matched_supply: 'Manual research',
        unresolved_gap: 'Manual workflows are slow.'
      },
      ai_agent_fill: {
        feasibility: 'high',
        can_do: ['Collect and summarize signals'],
        cannot_do: ['Guarantee market demand'],
        required_inputs: ['Source list']
      },
      third_party_supply_path: {
        needed: false,
        provider_type: 'not the first path',
        why: 'No specialist fulfillment required for the MVP.',
        handoff_boundary: 'Add external providers only for scale.'
      },
      scoring_assessment: {
        demand_strength: 'high',
        supply_gap: 'clear',
        agent_feasibility: 'high',
        payment_signal: 'inferred',
        evidence_quality: 'medium'
      },
      confidence: 0.72,
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
    expect(repository.listSupplyAnalyses('run-1')[0]?.existing_supply_fit.unresolved_gap).toBe('Manual workflows are slow.');
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

  it('dedupes brokerage supply by source key and reuses the active Fiverr draft', () => {
    const db = openDatabase(':memory:');
    const repository = new DemandRadarRepository(db);
    const first = repository.upsertBrokerageSupplyItem({
      platform: 'goofish',
      source_key: 'goofish:item:123',
      source_url: 'https://www.goofish.com/item?id=123',
      title: 'Logo design service',
      seller: 'seller-a',
      price: '100',
      location: 'Shanghai',
      raw: { id: '123' },
      seenAt: now
    });
    const second = repository.upsertBrokerageSupplyItem({
      platform: 'goofish',
      source_key: 'goofish:item:123',
      source_url: 'https://www.goofish.com/item?id=123',
      title: 'Logo design service updated',
      seller: 'seller-a',
      price: '120',
      location: 'Shanghai',
      raw: { id: '123', updated: true },
      seenAt: '2026-06-19T00:00:00.000Z'
    });

    const draftA = repository.saveFiverrGigDraft({
      supplyItemId: first.id,
      formFillMap: { title_suffix_after_i_will: 'coordinate logo delivery' },
      markdownPath: '.tmp/drafts.md',
      markdown: 'draft a',
      pricingAssumptions: { margin_percent: 40 },
      now
    });
    const draftB = repository.saveFiverrGigDraft({
      supplyItemId: second.id,
      formFillMap: { title_suffix_after_i_will: 'coordinate logo delivery updated' },
      markdownPath: '.tmp/drafts.md',
      markdown: 'draft b',
      pricingAssumptions: { margin_percent: 40 },
      now: '2026-06-19T00:00:00.000Z'
    });

    expect(second.id).toBe(first.id);
    expect(second.seen_count).toBe(2);
    expect(draftB.id).toBe(draftA.id);
    expect(repository.listFiverrGigDrafts(['draft_generated'], 10)).toHaveLength(1);

    db.close();
  });

  it('keeps terminal Fiverr supply statuses out of the upload queue', () => {
    const db = openDatabase(':memory:');
    const repository = new DemandRadarRepository(db);
    const supply = repository.upsertBrokerageSupplyItem({
      platform: 'goofish',
      source_key: 'goofish:item:published',
      source_url: 'https://www.goofish.com/item?id=published',
      title: 'Website setup',
      raw: { id: 'published' },
      seenAt: now
    });
    const draft = repository.saveFiverrGigDraft({
      supplyItemId: supply.id,
      formFillMap: { title_suffix_after_i_will: 'coordinate website setup' },
      markdownPath: '.tmp/drafts.md',
      markdown: 'draft',
      pricingAssumptions: { margin_percent: 40 },
      now
    });

    repository.recordFiverrUploadEvent({
      draftId: draft.id,
      eventType: 'published',
      status: 'published',
      now: '2026-06-19T00:00:00.000Z'
    });
    const seenAgain = repository.upsertBrokerageSupplyItem({
      platform: 'goofish',
      source_key: 'goofish:item:published',
      source_url: 'https://www.goofish.com/item?id=published',
      title: 'Website setup updated',
      raw: { id: 'published', updated: true },
      seenAt: '2026-06-20T00:00:00.000Z'
    });

    expect(seenAgain.status).toBe('published');
    expect(repository.listFiverrGigDrafts(['draft_generated', 'asset_ready', 'draft_saved'], 10)).toHaveLength(0);
    expect(repository.getFiverrGigDraft(draft.id)?.status).toBe('published');

    db.close();
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
