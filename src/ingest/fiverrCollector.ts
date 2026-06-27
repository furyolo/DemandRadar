import { z } from 'zod';
import type { Hotspot, Source } from '../pipeline/types.js';
import { mapSignalsToHotspots, SignalIntentSchema } from './channelCollector.js';

const FiverrRecordSchema = z.object({
  platform: z.literal('fiverr').optional(),
  record_type: z.enum(['gig', 'seller', 'brief', 'buyer_request']).optional(),
  gig_id: z.union([z.string(), z.number()]).optional(),
  seller_id: z.union([z.string(), z.number()]).optional(),
  id: z.union([z.string(), z.number()]).optional(),
  url: z.string().url().optional(),
  gig_url: z.string().url().optional(),
  seller_url: z.string().url().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.string().optional(),
  snippet: z.string().optional(),
  seller: z.string().optional(),
  seller_name: z.string().optional(),
  published_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  price: z.union([z.string(), z.number()]).nullable().optional(),
  min_price: z.union([z.string(), z.number()]).nullable().optional(),
  max_price: z.union([z.string(), z.number()]).nullable().optional(),
  budget: z.union([z.string(), z.number()]).nullable().optional(),
  currency: z.string().optional(),
  location: z.string().nullable().optional(),
  seller_level: z.string().optional(),
  rating: z.union([z.string(), z.number()]).optional(),
  reviews_count: z.number().nonnegative().optional(),
  orders_in_queue: z.number().nonnegative().optional(),
  delivery_time: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  intent: SignalIntentSchema.optional(),
  raw: z.record(z.string(), z.unknown()).optional()
}).strict();

const FiverrImportSchema = z.union([
  z.array(FiverrRecordSchema),
  z.object({ gigs: z.array(FiverrRecordSchema), metadata: z.record(z.string(), z.unknown()).optional() }).strict(),
  z.object({ items: z.array(FiverrRecordSchema), metadata: z.record(z.string(), z.unknown()).optional() }).strict(),
  z.object({ results: z.array(FiverrRecordSchema), metadata: z.record(z.string(), z.unknown()).optional() }).strict()
]);

export type FiverrRecord = z.infer<typeof FiverrRecordSchema>;

export interface CollectFiverrOptions {
  runId: string;
  records: unknown;
  searchQuery: string;
  timeWindowDays: number;
  generatedAt: string;
  limit?: number;
}

export function collectFiverrHotspots(options: CollectFiverrOptions): { sources: Source[]; hotspots: Hotspot[] } {
  const parsed = FiverrImportSchema.parse(options.records);
  const records = (Array.isArray(parsed) ? parsed : 'gigs' in parsed ? parsed.gigs : 'items' in parsed ? parsed.items : parsed.results)
    .slice(0, options.limit);

  return mapSignalsToHotspots(records.map((record) => {
    const gigId = stringValue(record.gig_id ?? record.id);
    const url = record.url ?? record.gig_url ?? record.seller_url ?? (gigId ? `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(record.title)}` : undefined);
    if (!url) {
      throw new Error('Fiverr record requires url, gig_url, seller_url, gig_id, or id');
    }

    return {
      channel: 'fiverr',
      runId: options.runId,
      url,
      title: record.title,
      content: record.snippet ?? record.description ?? record.content ?? '',
      author: record.seller ?? record.seller_name,
      authorUrl: record.seller_url,
      publishedAt: record.published_at ?? null,
      updatedAt: record.updated_at ?? null,
      searchQuery: options.searchQuery,
      timeWindowDays: options.timeWindowDays,
      generatedAt: options.generatedAt,
      intent: record.intent ?? inferIntent(record),
      price: record.budget ?? record.price ?? record.min_price,
      location: record.location,
      metrics: {
        rating: numberValue(record.rating),
        reviews_count: record.reviews_count,
        orders_in_queue: record.orders_in_queue
      },
      tags: record.tags,
      heatScore: heatScore(record),
      raw: {
        ...(record.raw ?? {}),
        gig_id: gigId,
        seller_id: stringValue(record.seller_id),
        record_type: record.record_type,
        currency: record.currency,
        seller_level: record.seller_level,
        min_price: record.min_price,
        max_price: record.max_price,
        delivery_time: record.delivery_time,
        category: record.category
      }
    };
  }), options.limit);
}

function inferIntent(record: FiverrRecord): 'demand' | 'supply' | 'both' | 'unknown' {
  if (record.record_type === 'brief' || record.record_type === 'buyer_request') return 'demand';
  const text = [record.title, record.description, record.content, record.snippet, ...(record.tags ?? [])].join(' ').toLowerCase();
  if (/\b(need|looking for|request|brief|hire|want someone)\b/.test(text)) return 'demand';
  if (record.price !== undefined || record.min_price !== undefined || record.seller || record.seller_name) return 'supply';
  return 'unknown';
}

function heatScore(record: FiverrRecord): number {
  const reviewSignal = Math.log10((record.reviews_count ?? 0) + 1) * 10;
  const queueSignal = Math.min(record.orders_in_queue ?? 0, 20);
  const priceSignal = record.price !== undefined || record.min_price !== undefined || record.budget !== undefined ? 8 : 0;
  return Math.max(45, Math.min(100, 50 + reviewSignal + queueSignal + priceSignal));
}

function stringValue(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return String(value);
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}
