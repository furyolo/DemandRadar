import { describe, expect, it } from 'vitest';
import { buildCli } from '../src/cli.js';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadDemandRadarEnv } from '../src/config/env.js';

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
});
