import { describe, expect, it } from 'vitest';
import { renderFiverrGigDrafts } from '../src/reports/fiverrGigDraft.js';

describe('renderFiverrGigDrafts', () => {
  it('renders Fiverr-ready public fields and keeps Goofish source links private', () => {
    const markdown = renderFiverrGigDrafts({
      items: [
        {
          platform: 'goofish',
          item_id: '12345',
          url: 'https://www.goofish.com/item?id=12345',
          title: '接单 WordPress 企业网站搭建',
          description: '可做展示站、落地页和简单商城。',
          seller: 'supplier-a',
          price: '720',
          location: '杭州',
          raw: {}
        }
      ]
    }, {
      query: '网站搭建 接单',
      generatedAt: '2026-06-28T00:00:00.000Z',
      marginPercent: 50,
      cnyPerUsd: 7.2,
      payoutFeePercent: 20,
      fxLossPercent: 10
    });

    expect(markdown).toContain('## Draft 1: website setup or redesign coordination');
    expect(markdown).toContain('Fiverr Form Fill Map');
    expect(markdown).toContain('"title_suffix_after_i_will"');
    expect(markdown).toContain('"manual_publish_gate"');
    expect(markdown).toContain('### Fiverr 公开字段');
    expect(markdown).toContain('Programming & Tech / Website Development');
    expect(markdown).toContain('`website`');
    expect(markdown).toContain('| Basic |');
    expect(markdown).toContain('$210');
    expect(markdown).toContain('20% 提现/平台手续费与 10% 汇率折损');
    expect(markdown).toContain('Gallery / Media Assets');
    expect(markdown).toContain('at least 1 original landscape Gig image');
    expect(markdown).toContain('Aim for 20-60 seconds and do not exceed 75 seconds');
    expect(markdown).toContain('up to 2 PDFs');
    expect(markdown).toContain('Required Gig Image Brief');
    expect(markdown).toContain('Image Generation Prompt');
    expect(markdown).toContain('Use case: ads-marketing');
    expect(markdown).toContain('Size/aspect: 1280 x 769 px landscape.');
    expect(markdown).toContain('### 私有供给来源索引');
    expect(markdown).toContain('https://www.goofish.com/item?id=12345');
    expect(markdown).toContain('履约前检查');
  });

  it('filters demand-side Goofish records out of supply drafts', () => {
    const markdown = renderFiverrGigDrafts({
      items: [
        {
          platform: 'goofish',
          item_id: 'buyer-1',
          title: '求购 网站搭建 服务',
          price: '500',
          raw: {}
        }
      ]
    }, {
      query: '网站搭建',
      generatedAt: '2026-06-28T00:00:00.000Z'
    });

    expect(markdown).toContain('没有找到可转成 Fiverr Gig 的闲鱼供给记录');
  });
});
