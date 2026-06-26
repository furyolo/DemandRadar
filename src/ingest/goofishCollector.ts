import { z } from 'zod';
import type { Hotspot, Source } from '../pipeline/types.js';
import { mapSignalsToHotspots, SignalIntentSchema } from './channelCollector.js';

const GoofishRecordSchema = z.object({
  platform: z.union([z.literal('goofish'), z.literal('xianyu')]).optional(),
  item_id: z.union([z.string(), z.number()]).optional(),
  id: z.union([z.string(), z.number()]).optional(),
  url: z.string().url().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.string().optional(),
  snippet: z.string().optional(),
  seller: z.string().optional(),
  seller_id: z.union([z.string(), z.number()]).optional(),
  seller_url: z.string().url().optional(),
  author: z.string().optional(),
  published_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  price: z.union([z.string(), z.number()]).nullable().optional(),
  currency: z.string().optional(),
  location: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  condition: z.string().optional(),
  want_count: z.number().nonnegative().optional(),
  wantCount: z.number().nonnegative().optional(),
  view_count: z.number().nonnegative().optional(),
  viewCount: z.number().nonnegative().optional(),
  favorite_count: z.number().nonnegative().optional(),
  favoriteCount: z.number().nonnegative().optional(),
  tags: z.array(z.string()).optional(),
  intent: SignalIntentSchema.optional(),
  raw: z.record(z.string(), z.unknown()).optional()
}).strict();

const GoofishImportSchema = z.union([
  z.array(GoofishRecordSchema),
  z.object({ items: z.array(GoofishRecordSchema), metadata: z.record(z.string(), z.unknown()).optional() }).strict(),
  z.object({ listings: z.array(GoofishRecordSchema), metadata: z.record(z.string(), z.unknown()).optional() }).strict(),
  z.object({ results: z.array(GoofishRecordSchema), metadata: z.record(z.string(), z.unknown()).optional() }).strict()
]);

export type GoofishRecord = z.infer<typeof GoofishRecordSchema>;

export interface CollectGoofishOptions {
  runId: string;
  records: unknown;
  searchQuery: string;
  timeWindowDays: number;
  generatedAt: string;
  limit?: number;
}

export function collectGoofishHotspots(options: CollectGoofishOptions): { sources: Source[]; hotspots: Hotspot[] } {
  const parsed = GoofishImportSchema.parse(options.records);
  const records = (Array.isArray(parsed) ? parsed : 'items' in parsed ? parsed.items : 'listings' in parsed ? parsed.listings : parsed.results)
    .slice(0, options.limit);

  return mapSignalsToHotspots(records.map((record) => {
    const itemId = stringValue(record.item_id ?? record.id);
    const url = record.url ?? (itemId ? `https://www.goofish.com/item?id=${encodeURIComponent(itemId)}` : undefined);
    if (!url) {
      throw new Error('Goofish record requires url or item_id');
    }

    return {
      channel: 'goofish',
      runId: options.runId,
      url,
      title: record.title,
      content: record.snippet ?? record.description ?? record.content ?? '',
      author: record.seller ?? record.author,
      authorUrl: record.seller_url,
      publishedAt: record.published_at ?? null,
      updatedAt: record.updated_at ?? null,
      searchQuery: options.searchQuery,
      timeWindowDays: options.timeWindowDays,
      generatedAt: options.generatedAt,
      intent: record.intent ?? inferIntent(record),
      price: record.price,
      location: record.location ?? record.city,
      metrics: {
        want_count: record.want_count ?? record.wantCount,
        view_count: record.view_count ?? record.viewCount,
        favorite_count: record.favorite_count ?? record.favoriteCount
      },
      tags: record.tags,
      heatScore: heatScore(record),
      raw: {
        ...(record.raw ?? {}),
        item_id: itemId,
        seller_id: stringValue(record.seller_id),
        currency: record.currency,
        condition: record.condition
      }
    };
  }), options.limit);
}

function inferIntent(record: GoofishRecord): 'demand' | 'supply' | 'both' | 'unknown' {
  const text = [record.title, record.description, record.content, record.snippet, ...(record.tags ?? [])].join(' ');
  if (/求购|求租|求带|找人|找个|代办|帮忙|收一个|有没有|可不可以|需要/.test(text)) return 'demand';
  if (/出售|转让|出一个|自用|全新|成新|接单|代|服务|维修|回收/.test(text)) return 'supply';
  return record.price !== undefined ? 'supply' : 'unknown';
}

function heatScore(record: GoofishRecord): number {
  const engagement = (record.want_count ?? record.wantCount ?? 0)
    + (record.favorite_count ?? record.favoriteCount ?? 0)
    + Math.min(record.view_count ?? record.viewCount ?? 0, 1000) / 20;
  const priceSignal = record.price === undefined || record.price === null ? 0 : 8;
  if (engagement <= 0) return 50 + priceSignal;
  return Math.max(50, Math.min(100, 50 + priceSignal + Math.log10(engagement + 1) * 12));
}

function stringValue(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return String(value);
}
