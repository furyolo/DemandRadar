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
      minSourceMultiple: 10,
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
    expect(markdown).toContain('$1390');
    expect(markdown).toContain('净收入至少覆盖闲鱼成本 10x');
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

  it('does not classify generic service text as logo delivery', () => {
    const markdown = renderFiverrGigDrafts({
      items: [
        {
          platform: 'goofish',
          item_id: 'n8n-1',
          title: 'n8n工作流代开发',
          description: 'n8n工作流代做，支持自动化流程、API接入和定制开发。',
          price: '20',
          raw: {}
        }
      ]
    }, {
      query: 'Fiverr-fit curated service supply',
      generatedAt: '2026-06-29T00:00:00.000Z'
    });

    expect(markdown).toContain('## Draft 1: AI automation delivery');
    expect(markdown).toContain('Programming & Tech / AI Development');
    expect(markdown).not.toContain('## Draft 1: Logo and brand asset delivery');
  });

  it('does not treat PS AI CDR design listings as AI automation', () => {
    const markdown = renderFiverrGigDrafts({
      items: [
        {
          platform: 'goofish',
          item_id: 'design-1',
          title: 'PS海报设计代做',
          description: '熟练使用PS/AI/CDR，可做海报、Logo、画册、包装设计和电商主图。',
          price: '5',
          raw: {}
        }
      ]
    }, {
      query: '精选可交付供给',
      generatedAt: '2026-06-29T00:00:00.000Z'
    });

    expect(markdown).toContain('## Draft 1: Logo and brand asset delivery');
    expect(markdown).toContain('Graphics & Design / Logo Design');
    expect(markdown).not.toContain('## Draft 1: AI automation delivery');
  });

  it('uses the 10x source-cost floor for low traffic Goofish prices', () => {
    const markdown = renderFiverrGigDrafts({
      items: [
        {
          platform: 'goofish',
          item_id: 'automation-1',
          title: 'n8n 自动化流程代做',
          description: '按需求定制 API 接入和自动化流程。',
          price: '20',
          raw: {}
        }
      ]
    }, {
      query: 'n8n 自动化 代做',
      generatedAt: '2026-06-29T00:00:00.000Z',
      marginPercent: 40,
      minSourceMultiple: 10,
      cnyPerUsd: 7.2,
      payoutFeePercent: 20,
      fxLossPercent: 10
    });

    expect(markdown).toContain('## Draft 1: AI automation delivery');
    expect(markdown).toContain('| Basic | Source coordination, requirement check, and one deliverable handoff | 7 days | 1 | $40 |');
    expect(markdown).not.toContain('| Basic | Source coordination, requirement check, and one deliverable handoff | 7 days | 1 | $6 |');
  });
});
