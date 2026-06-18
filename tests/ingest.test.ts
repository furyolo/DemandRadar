import { describe, expect, it } from 'vitest';
import fixture from './fixtures/smart-search-results.json' with { type: 'json' };
import { collectHotspots } from '../src/ingest/hotspotCollector.js';
import type { SmartSearchCommandResult } from '../src/integrations/smartSearchClient.js';

describe('collectHotspots', () => {
  it('maps Smart Search fixture results into sources and hotspots', async () => {
    const client = {
      search: async (query: string): Promise<SmartSearchCommandResult> => ({
        command: ['smart-search', 'search', query],
        query,
        stdout: JSON.stringify(fixture),
        stderr: '',
        exitCode: 0,
        parsed: fixture,
        started_at: '2026-06-18T00:00:00.000Z',
        completed_at: '2026-06-18T00:00:01.000Z'
      }),
      exaSearch: async (query: string): Promise<SmartSearchCommandResult> => ({
        command: ['smart-search', 'exa-search', query],
        query,
        stdout: JSON.stringify(fixture),
        stderr: '',
        exitCode: 0,
        parsed: fixture,
        started_at: '2026-06-18T00:00:00.000Z',
        completed_at: '2026-06-18T00:00:01.000Z'
      })
    };

    const result = await collectHotspots({
      runId: 'run-1',
      client,
      limit: 6,
      timeWindowDays: 30,
      generatedAt: '2026-06-18T00:00:00.000Z'
    });

    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.hotspots[0]?.time_window).toBe('30d');
  });
});
