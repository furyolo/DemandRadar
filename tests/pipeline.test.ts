import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runPipeline } from '../src/pipeline/runPipeline.js';
import { openDatabase } from '../src/storage/database.js';
import { DemandRadarRepository } from '../src/storage/repositories.js';
import { fixtureData } from './support/pipelineFixture.js';

describe('runPipeline', () => {
  it('persists fixture data and writes report artifacts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'demandradar-'));
    const db = openDatabase(':memory:');
    const repository = new DemandRadarRepository(db);

    const result = await runPipeline({
      date: '2026-06-18',
      limit: 10,
      fixtureMode: true,
      reportsDir: join(dir, 'reports'),
      briefsDir: join(dir, 'briefs'),
      repository,
      fixtureData
    });

    expect(result.reports.some((report) => report.path === 'reports/2026-06-18.md')).toBe(true);
    expect(result.reports.some((report) => report.path === 'reports/2026-06-18.md' && report.cadence === 'daily' && report.locale === 'en')).toBe(true);
    expect(repository.getRunSummary(result.run.id).demand_count).toBeGreaterThan(0);
    db.close();
  });

  it('generates requested rollups and zh-CN variants', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'demandradar-'));
    const db = openDatabase(':memory:');
    const repository = new DemandRadarRepository(db);

    const result = await runPipeline({
      date: '2026-06-18',
      limit: 10,
      fixtureMode: true,
      reportsDir: join(dir, 'reports'),
      briefsDir: join(dir, 'briefs'),
      repository,
      fixtureData,
      cadences: ['daily', 'weekly', 'monthly'],
      locales: ['en', 'zh-CN'],
      translationLlm: {
        async generateText() {
          return '# Translated zh-CN\n\nhttps://example.com/report';
        }
      }
    });

    expect(result.reports.some((report) => report.cadence === 'weekly' && report.locale === 'en')).toBe(true);
    expect(result.reports.some((report) => report.cadence === 'monthly' && report.locale === 'en')).toBe(true);
    expect(result.reports.some((report) => report.locale === 'zh-CN' && report.canonical_report_id)).toBe(true);
    db.close();
  });

  it('keeps English artifact persists when zh-CN translation fails', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'demandradar-'));
    const db = openDatabase(':memory:');
    const repository = new DemandRadarRepository(db);

    const result = await runPipeline({
      date: '2026-06-18',
      fixtureMode: true,
      reportsDir: join(dir, 'reports'),
      briefsDir: join(dir, 'briefs'),
      repository,
      fixtureData,
      locales: ['en', 'zh-CN'],
      translationLlm: {
        async generateText() {
          throw new Error('translation failed');
        }
      }
    });

    expect(result.reports.some((report) => report.path === 'reports/2026-06-18.md' && report.locale === 'en')).toBe(true);
    expect(result.reports.some((report) => report.locale === 'zh-CN')).toBe(false);
    db.close();
  });
});
