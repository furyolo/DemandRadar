import { describe, expect, it } from 'vitest';
import { collectFiverrHotspots } from '../src/ingest/fiverrCollector.js';

describe('collectFiverrHotspots', () => {
  it('maps imported Fiverr gigs into supply-side sources and hotspots', () => {
    const result = collectFiverrHotspots({
      runId: 'run-1',
      searchQuery: 'fiverr ai chatbot supply',
      timeWindowDays: 30,
      generatedAt: '2026-06-18T00:00:00.000Z',
      records: {
        metadata: { provider: 'fiverr-mcp-server' },
        gigs: [
          {
            platform: 'fiverr',
            gig_id: '396045309',
            gig_url: 'https://www.fiverr.com/seller/build-ai-chatbot',
            title: 'I will build an AI chatbot for your website',
            description: 'Chatbot setup with OpenAI integration and website widget.',
            seller_name: 'seller',
            price: '$120',
            rating: '4.9',
            reviews_count: 80,
            orders_in_queue: 3,
            seller_level: 'level_two_seller',
            tags: ['chatbot', 'openai'],
            raw: { platform: 'wrong-platform' }
          }
        ]
      }
    });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.source_name).toBe('fiverr');
    expect(result.sources[0]?.raw).toMatchObject({
      platform: 'fiverr',
      channel: 'fiverr',
      intent: 'supply',
      author: 'seller',
      price: '$120',
      gig_id: '396045309',
      seller_level: 'level_two_seller'
    });
    expect(result.hotspots[0]).toMatchObject({ domain: 'global_expansion', search_query: 'fiverr ai chatbot supply' });
    expect(result.hotspots[0]?.heat_score).toBeGreaterThan(50);
  });

  it('keeps Fiverr briefs as demand signals when present', () => {
    const result = collectFiverrHotspots({
      runId: 'run-1',
      searchQuery: 'fiverr briefs',
      timeWindowDays: 30,
      generatedAt: '2026-06-18T00:00:00.000Z',
      records: [
        {
          platform: 'fiverr',
          record_type: 'brief',
          id: 'brief-1',
          title: 'Need someone to automate Shopify product descriptions',
          budget: '$250',
          content: 'Looking for a fast turnaround.',
          seller_url: 'https://www.fiverr.com/'
        }
      ]
    });

    expect(result.sources[0]?.raw).toMatchObject({
      platform: 'fiverr',
      intent: 'demand',
      price: '$250',
      record_type: 'brief'
    });
  });
});
