import type { GoofishCliImportResult, GoofishImportItem } from '../integrations/goofishCliAdapter.js';
import { buildGoofishFiverrFitQueries } from '../ingest/fiverrKeywordDiscovery.js';

export const DEFAULT_FIVERR_FIT_QUERIES = buildGoofishFiverrFitQueries();

export type FiverrFitCategory = 'automation' | 'data' | 'design' | 'presentation' | 'video' | 'development';

export type RejectionReason =
  | 'duplicate'
  | 'demand_side'
  | 'resource_or_course_risk'
  | 'not_fiverr_service_like'
  | 'no_concrete_deliverable';

export interface GoofishFiverrCurateOptions {
  maxItems?: number;
  maxPerCategory?: number;
}

export interface CuratedGoofishItem extends GoofishImportItem {
  raw: GoofishImportItem['raw'] & {
    source_query?: string;
    fit_category?: FiverrFitCategory;
  };
}

export interface RejectedGoofishItem {
  item: GoofishImportItem;
  reason: RejectionReason;
  source_query?: string;
  matched_category?: FiverrFitCategory;
}

export interface GoofishFiverrCurateResult {
  items: CuratedGoofishItem[];
  rejected: RejectedGoofishItem[];
  metadata: {
    provider: 'goofish-cli';
    query: string;
    generated_at: string;
    total_input: number;
    kept_before_cap: number;
    exported: number;
    rejected: number;
    max_items: number;
    max_per_category: number;
    default_queries: string[];
    policy: string;
  };
}

interface CategoryRule {
  category: FiverrFitCategory;
  pattern: RegExp;
}

const DEFAULT_MAX_ITEMS = 12;
const DEFAULT_MAX_PER_CATEGORY = 2;

const demandPattern = /求购|求租|找人|找个|需要|有没有|收一个/;
const riskPattern = /课程|教程|教学|辅导|陪跑|资料|模板|网盘|百度网盘|自动发货|虚拟商品|配方|书|素材|源码合集|源文件|接单群|组队系统|福袋|包100分|作业|考试|论文|毕业|代考|侵权|免责声明|二手|标牌|课程大合集|保存后立即看|拍下秒发|永久有效|会员|全套|合集|求职|招聘|小伙伴/;
const deliverablePattern = /代做|定制|开发|搭建|设计|剪辑|制作|美化|调试|部署|报表|看板|数据清洗|环境配置|接单|修改|二开|接口对接/i;

const categoryRules: CategoryRule[] = [
  {
    category: 'automation',
    pattern: /n8n|coze|dify|chatbot|自动化|automation|bot|智能体|工作流|rpa|api接入|ai\s*(agent|automation|workflow|应用|智能体|工作流|自动化)/i
  },
  {
    category: 'data',
    pattern: /power\s*bi|powerbi|tableau|数据清洗|数据可视化|可视化|看板|报表|dax|powerquery|商业分析/i
  },
  {
    category: 'design',
    pattern: /logo|标志|品牌|视觉识别|\bvi\b|ui|海报|平面设计|包装设计|电商设计|主图|详情页|画册|名片|app页面/i
  },
  {
    category: 'presentation',
    pattern: /ppt|presentation|演示文稿|幻灯片|路演|汇报/i
  },
  {
    category: 'video',
    pattern: /视频剪辑|视频制作|ai视频|aigc|宣传片|短视频|seedance|图生视频|pr|ae|达芬奇|调色|字幕包装/i
  },
  {
    category: 'development',
    pattern: /laravel|yii2|php|python|yolo|obs|vts|ue5|ue4|网站|网页|系统|小程序|环境搭建|虚拟直播间|软件开发|后台管理|数据库/i
  }
];

export function curateGoofishForFiverr(
  inputs: Array<GoofishCliImportResult | { items: GoofishImportItem[]; metadata?: Record<string, unknown> }>,
  options: GoofishFiverrCurateOptions = {}
): GoofishFiverrCurateResult {
  const maxItems = normalizePositiveInteger(options.maxItems, DEFAULT_MAX_ITEMS);
  const maxPerCategory = normalizePositiveInteger(options.maxPerCategory, DEFAULT_MAX_PER_CATEGORY);
  const seen = new Set<string>();
  const kept: CuratedGoofishItem[] = [];
  const rejected: RejectedGoofishItem[] = [];

  for (const input of inputs) {
    const sourceQuery = sourceQueryOf(input);
    for (const item of input.items) {
      const key = itemKey(item);
      const category = classifyFiverrFitCategory(item);
      const reason = rejectionReason(item, category, seen.has(key));
      if (reason) {
        rejected.push({ item, reason, source_query: sourceQuery, matched_category: category });
        continue;
      }
      seen.add(key);
      kept.push({
        ...item,
        raw: {
          ...item.raw,
          source_query: stringValue(item.raw.source_query) ?? sourceQuery,
          fit_category: category
        }
      });
    }
  }

  const items = balancedPick(kept, { maxItems, maxPerCategory });

  return {
    items,
    rejected,
    metadata: {
      provider: 'goofish-cli',
      query: 'Fiverr-fit curated service supply',
      generated_at: new Date().toISOString(),
      total_input: kept.length + rejected.length,
      kept_before_cap: kept.length,
      exported: items.length,
      rejected: rejected.length,
      max_items: maxItems,
      max_per_category: maxPerCategory,
      default_queries: DEFAULT_FIVERR_FIT_QUERIES,
      policy: [
        'Keep concrete Fiverr-style service deliverables only.',
        'Reject courses, tutorials, resource packs, templates, Netdisk deliveries, homework/exam work, recruiting posts, and copyright-risk listings.',
        'Balance output across service categories before draft generation.'
      ].join(' ')
    }
  };
}

export function classifyFiverrFitCategory(item: GoofishImportItem): FiverrFitCategory | undefined {
  const text = searchableText(item);
  return categoryRules.find((rule) => rule.pattern.test(text))?.category;
}

function rejectionReason(item: GoofishImportItem, category: FiverrFitCategory | undefined, duplicate: boolean): RejectionReason | undefined {
  const text = searchableText(item);
  if (duplicate) return 'duplicate';
  if (demandPattern.test(text)) return 'demand_side';
  if (riskPattern.test(text)) return 'resource_or_course_risk';
  if (!category) return 'not_fiverr_service_like';
  if (!deliverablePattern.test(text)) return 'no_concrete_deliverable';
  return undefined;
}

function balancedPick(items: CuratedGoofishItem[], options: { maxItems: number; maxPerCategory: number }): CuratedGoofishItem[] {
  const groups = new Map<FiverrFitCategory, CuratedGoofishItem[]>();
  for (const item of items) {
    const category = item.raw.fit_category;
    if (!category) continue;
    const group = groups.get(category) ?? [];
    if (group.length < options.maxPerCategory) group.push(item);
    groups.set(category, group);
  }

  const picked: CuratedGoofishItem[] = [];
  const categories = categoryRules.map((rule) => rule.category);
  let madeProgress = true;
  for (let index = 0; picked.length < options.maxItems && madeProgress; index += 1) {
    madeProgress = false;
    for (const category of categories) {
      const candidate = groups.get(category)?.[index];
      if (!candidate) continue;
      picked.push(candidate);
      madeProgress = true;
      if (picked.length >= options.maxItems) break;
    }
  }
  return picked;
}

function searchableText(item: GoofishImportItem): string {
  return [item.title, item.description, ...(item.tags ?? [])].join(' ').toLowerCase();
}

function itemKey(item: GoofishImportItem): string {
  if (item.item_id) return `item:${item.item_id}`;
  if (item.url) return `url:${item.url.toLowerCase()}`;
  return `title:${item.title.toLowerCase()}`;
}

function sourceQueryOf(input: GoofishCliImportResult | { metadata?: Record<string, unknown> }): string | undefined {
  if (!input.metadata) return undefined;
  return stringValue(input.metadata.query);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}
