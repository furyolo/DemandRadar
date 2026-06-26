import { describe, expect, it } from 'vitest';
import { buildGoofishSearchArgs, normalizeGoofishCliItems } from '../src/integrations/goofishCliAdapter.js';

describe('goofishCliAdapter', () => {
  it('builds read-only goofish-cli search args', () => {
    expect(buildGoofishSearchArgs({
      query: '闲鱼 求购 家教',
      limit: 20,
      commandArgs: ['goofish-cli']
    })).toEqual([
      'goofish-cli',
      'search',
      'items',
      '闲鱼 求购 家教',
      '--limit',
      '20',
      '--format',
      'json'
    ]);
  });

  it('normalizes common goofish-cli JSON list fields', () => {
    const items = normalizeGoofishCliItems({
      data: [
        {
          itemId: '12345',
          title: '求购同城上门家教服务',
          desc: '孩子需要周末数学陪练，预算可谈。',
          sellerNick: 'buyer',
          price: '200',
          area: '杭州',
          wantCount: 12,
          viewCount: 100
        }
      ]
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      platform: 'goofish',
      item_id: '12345',
      title: '求购同城上门家教服务',
      description: '孩子需要周末数学陪练，预算可谈。',
      seller: 'buyer',
      price: '200',
      location: '杭州',
      want_count: 12,
      view_count: 100
    });
  });
});
