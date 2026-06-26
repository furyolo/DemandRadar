import { describe, expect, it } from 'vitest';
import { collectGoofishHotspots } from '../src/ingest/goofishCollector.js';

describe('collectGoofishHotspots', () => {
  it('maps imported Goofish listings into sources and hotspots', () => {
    const result = collectGoofishHotspots({
      runId: 'run-1',
      searchQuery: '闲鱼 求购 家教',
      timeWindowDays: 30,
      generatedAt: '2026-06-18T00:00:00.000Z',
      records: {
        metadata: { provider: 'goofish-cli' },
        items: [
          {
            platform: 'goofish',
            item_id: '12345',
            title: '求购同城上门家教服务',
            description: '孩子需要周末数学陪练，预算可谈。',
            seller: 'buyer',
            price: '200',
            city: '杭州',
            want_count: 12,
            tags: ['求购', '家教'],
            raw: { platform: 'wrong-platform' }
          }
        ]
      }
    });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.source_name).toBe('goofish');
    expect(result.sources[0]?.source_url).toBe('https://www.goofish.com/item?id=12345');
    expect(result.sources[0]?.raw).toMatchObject({
      platform: 'goofish',
      channel: 'goofish',
      intent: 'demand',
      author: 'buyer',
      price: '200',
      location: '杭州',
      item_id: '12345'
    });
    expect(result.hotspots[0]).toMatchObject({ domain: 'goofish', search_query: '闲鱼 求购 家教' });
    expect(result.hotspots[0]?.heat_score).toBeGreaterThan(50);
  });
});
