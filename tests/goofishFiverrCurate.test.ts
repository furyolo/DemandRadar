import { describe, expect, it } from 'vitest';
import { curateGoofishForFiverr } from '../src/reports/goofishFiverrCurate.js';
import type { GoofishImportItem } from '../src/integrations/goofishCliAdapter.js';

describe('curateGoofishForFiverr', () => {
  it('keeps concrete Fiverr-style services and rejects risky resource listings', () => {
    const result = curateGoofishForFiverr([
      {
        items: [
          item('n8n-1', 'n8n工作流代开发', '支持工作流部署、API接入和定制开发。'),
          item('course-1', '剪映零基础速成实战课42节带配套素材', '百度网盘自动发货，虚拟商品。'),
          item('buyer-1', '求购 网站搭建 服务', '需要找人搭建企业官网。'),
          item('data-1', 'Power BI代做｜可视化看板搭建', '支持数据清洗、报表和分析模型搭建。')
        ],
        metadata: { query: 'mixed' }
      }
    ], {
      maxItems: 10,
      maxPerCategory: 2
    });

    expect(result.items.map((kept) => kept.item_id)).toEqual(['n8n-1', 'data-1']);
    expect(result.items[0]!.raw.fit_category).toBe('automation');
    expect(result.items[1]!.raw.fit_category).toBe('data');
    expect(result.rejected.map((rejected) => rejected.reason)).toEqual([
      'resource_or_course_risk',
      'demand_side'
    ]);
  });

  it('balances curated output across categories before draft generation', () => {
    const result = curateGoofishForFiverr([
      {
        items: [
          item('auto-1', 'n8n工作流代开发', '自动化流程定制开发。'),
          item('auto-2', 'Coze智能体定制服务', '工作流搭建和API接入。'),
          item('auto-3', 'Dify应用搭建代做', '智能体开发和自动化部署。'),
          item('ppt-1', 'PPT美化设计代做', '会议PPT制作和排版美化。'),
          item('ppt-2', 'PPT代做 可加急', '演示文稿制作和修改。'),
          item('video-1', '视频剪辑制作接单', 'PR AE剪辑、字幕包装和调色。')
        ],
        metadata: { query: 'balanced' }
      }
    ], {
      maxItems: 6,
      maxPerCategory: 2
    });

    expect(result.items.map((kept) => kept.item_id)).toEqual([
      'auto-1',
      'ppt-1',
      'video-1',
      'auto-2',
      'ppt-2'
    ]);
    expect(result.rejected).toHaveLength(0);
  });
});

function item(item_id: string, title: string, description: string): GoofishImportItem {
  return {
    platform: 'goofish',
    item_id,
    title,
    description,
    price: '10',
    raw: {}
  };
}
