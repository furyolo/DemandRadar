import { access } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runPipeline } from '../src/pipeline/runPipeline.js';
import { openDatabase } from '../src/storage/database.js';
import { DemandRadarRepository } from '../src/storage/repositories.js';
import { fixtureData } from './support/pipelineFixture.js';

describe('fixture E2E', () => {
  it('runs the pipeline with fixtures and writes reports plus briefs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'demandradar-e2e-'));
    const db = openDatabase(':memory:');
    const repository = new DemandRadarRepository(db);

    const result = await runPipeline({
      date: '2026-06-18',
      fixtureMode: true,
      reportsDir: join(dir, 'reports'),
      briefsDir: join(dir, 'briefs'),
      repository,
      fixtureData
    });

    expect(result.reports.some((report) => report.path === 'reports/2026-06-18.md')).toBe(true);
    expect(result.reports.filter((report) => report.path.includes('briefs/2026-06-18/')).length).toBeLessThanOrEqual(3);
    expect(repository.getRunSummary(result.run.id)).toMatchObject({
      demand_count: 1,
      report_count: 2
    });
    await access(join(dir, 'reports', '2026-06-18.md'));
    await access(join(dir, 'briefs', '2026-06-18'));
    db.close();
  });
});
