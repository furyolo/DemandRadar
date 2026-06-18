import { describe, expect, it } from 'vitest';
import { buildCli } from '../src/cli.js';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadDemandRadarEnv } from '../src/config/env.js';
import { openDatabase } from '../src/storage/database.js';
import { DemandRadarRepository } from '../src/storage/repositories.js';

describe('buildCli', () => {
  it('registers run, list, show, and report commands', () => {
    const names = buildCli().commands.map((command) => command.name());
    expect(names).toContain('run');
    expect(names).toContain('list');
    expect(names).toContain('show');
    expect(names).toContain('report');
  });

  it('loads config env without overriding existing shell values', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'demandradar-env-'));
    const envPath = join(dir, '.env');
    const previousBaseUrl = process.env.LLM_BASE_URL;
    const previousModel = process.env.LLM_MODEL;
    process.env.LLM_BASE_URL = 'https://shell.example/v1';
    delete process.env.LLM_MODEL;
    await writeFile(envPath, 'LLM_BASE_URL=https://file.example/v1\nLLM_MODEL=test-model\n', 'utf8');

    loadDemandRadarEnv(envPath);

    expect(process.env.LLM_BASE_URL).toBe('https://shell.example/v1');
    expect(process.env.LLM_MODEL).toBe('test-model');

    process.env.LLM_BASE_URL = previousBaseUrl;
    process.env.LLM_MODEL = previousModel;
  });

  it('prints legacy report 2026-06-18 path without a database', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'demandradar-cli-'));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '2026-06-18.md'), '# Daily\n', 'utf8');
    const output = await captureStdout(async () => {
      await buildCli().exitOverride().parseAsync(['report', '2026-06-18', '--reports-dir', dir], { from: 'user' });
    });

    expect(output.trim()).toBe(join(dir, '2026-06-18.md'));
  });

  it('prints repository-backed weekly with --cadence weekly and reports localized variant missing with --locale zh-CN', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'demandradar-cli-'));
    const reportsDir = join(dir, 'reports');
    await mkdir(join(reportsDir, 'weekly'), { recursive: true });
    await writeFile(join(reportsDir, 'weekly', '2026-06-12_to_2026-06-18.en.md'), '# Weekly\n', 'utf8');
    const dbPath = join(dir, 'demandradar.sqlite');
    const db = openDatabase(dbPath);
    const repository = new DemandRadarRepository(db);
    repository.createRun({
      id: 'run-1',
      started_at: '2026-06-18T00:00:00.000Z',
      completed_at: '2026-06-18T00:00:00.000Z',
      status: 'completed',
      query_window_days: 30,
      top_hotspot_limit: 10,
      metadata: {}
    });
    repository.saveReportArtifact({
      id: 'report-weekly',
      run_id: 'run-1',
      report_type: 'weekly',
      demand_id: null,
      cadence: 'weekly',
      locale: 'en',
      canonical_report_id: null,
      period_start: '2026-06-12',
      period_end: '2026-06-18',
      path: 'reports/weekly/2026-06-12_to_2026-06-18.en.md',
      title: 'DemandRadar Weekly',
      generated_at: '2026-06-18T00:00:00.000Z',
      metadata: {}
    });
    db.close();

    const output = await captureStdout(async () => {
      await buildCli().exitOverride().parseAsync(['report', '2026-06-18', '--db', dbPath, '--reports-dir', reportsDir, '--cadence', 'weekly'], { from: 'user' });
    });
    expect(output.trim()).toContain('weekly/2026-06-12_to_2026-06-18.en.md');

    await expect(buildCli().exitOverride().parseAsync(['report', '2026-06-18', '--db', dbPath, '--reports-dir', reportsDir, '--cadence', 'weekly', '--locale', 'zh-CN'], { from: 'user' }))
      .rejects.toThrow('localized variant missing');
  });
});

async function captureStdout(action: () => Promise<void>): Promise<string> {
  const original = console.log;
  const lines: string[] = [];
  console.log = (value?: unknown) => {
    lines.push(String(value ?? ''));
  };
  try {
    await action();
  } finally {
    console.log = original;
  }
  return lines.join('\n');
}
