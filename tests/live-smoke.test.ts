import { describe, expect, it } from 'vitest';
import { SmartSearchClient } from '../src/integrations/smartSearchClient.js';

const runLive = process.env.RUN_LIVE_SMOKE === '1' && Boolean(process.env.SMART_SEARCH_BIN);

describe('live smoke', () => {
  it.skipIf(!runLive)('calls Smart Search when RUN_LIVE_SMOKE=1', async () => {
    const client = new SmartSearchClient({ timeoutMs: 15_000 });
    const result = await client.search('AI product opportunities last 7 days', { limit: 1 });
    expect(result.command.join(' ')).toContain('smart-search');
  });
});
