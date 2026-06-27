import { describe, expect, it } from 'vitest';
import { collectUpworkHotspots } from '../src/ingest/upworkCollector.js';

describe('collectUpworkHotspots', () => {
  it('maps imported Upwork jobs into paid demand sources and hotspots', () => {
    const result = collectUpworkHotspots({
      runId: 'run-1',
      searchQuery: 'upwork ai automation jobs',
      timeWindowDays: 30,
      generatedAt: '2026-06-18T00:00:00.000Z',
      records: {
        metadata: { provider: 'upwork-mcp' },
        jobs: [
          {
            platform: 'upwork',
            job_id: '~012345',
            title: 'Build an AI workflow automation agent',
            description: 'Need a developer to connect Airtable, Slack, and OpenAI for weekly reporting.',
            client_name: 'Acme Ops',
            budget: '$800',
            client_country: 'US',
            payment_verified: true,
            proposal_count: 4,
            client_total_spent: '$12000',
            skills: ['OpenAI API', 'Airtable', 'Slack'],
            raw: { platform: 'wrong-platform' }
          }
        ]
      }
    });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.source_name).toBe('upwork');
    expect(result.sources[0]?.source_url).toBe('https://www.upwork.com/jobs/~012345');
    expect(result.sources[0]?.raw).toMatchObject({
      platform: 'upwork',
      channel: 'upwork',
      intent: 'demand',
      author: 'Acme Ops',
      price: '$800',
      location: 'US',
      job_id: '~012345',
      payment_verified: true
    });
    expect(result.hotspots[0]).toMatchObject({ domain: 'global_expansion', search_query: 'upwork ai automation jobs' });
    expect(result.hotspots[0]?.heat_score).toBeGreaterThan(60);
  });
});
