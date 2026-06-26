import { z } from 'zod';
import type { Hotspot, Source } from '../pipeline/types.js';
import { buildRedNoteTimeMetadata } from '../time/rednoteTime.js';
import { mapSignalsToHotspots } from './channelCollector.js';

const RedNoteRecordSchema = z.object({
  platform: z.literal('rednote').optional(),
  url: z.string().url(),
  title: z.string().min(1),
  content: z.string().optional(),
  snippet: z.string().optional(),
  author: z.string().optional(),
  author_url: z.string().url().optional(),
  published_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  rednote_time_text: z.string().nullable().optional(),
  likes: z.number().nonnegative().optional(),
  collects: z.number().nonnegative().optional(),
  comments: z.number().nonnegative().optional(),
  tags: z.array(z.string()).optional(),
  raw: z.record(z.string(), z.unknown()).optional()
}).strict();

const RedNoteImportSchema = z.union([
  z.array(RedNoteRecordSchema),
  z.object({ notes: z.array(RedNoteRecordSchema) }).strict(),
  z.object({ results: z.array(RedNoteRecordSchema) }).strict()
]);

export type RedNoteRecord = z.infer<typeof RedNoteRecordSchema>;

export interface CollectRedNoteOptions {
  runId: string;
  records: unknown;
  searchQuery: string;
  timeWindowDays: number;
  generatedAt: string;
  limit?: number;
}

export function collectRedNoteHotspots(options: CollectRedNoteOptions): { sources: Source[]; hotspots: Hotspot[] } {
  const parsed = RedNoteImportSchema.parse(options.records);
  const records = (Array.isArray(parsed) ? parsed : 'notes' in parsed ? parsed.notes : parsed.results).slice(0, options.limit);
  return mapSignalsToHotspots(records.map((record) => {
    const time = buildRedNoteTimeMetadata({
      publishedAt: record.published_at,
      updatedAt: record.updated_at,
      rednoteTimeText: record.rednote_time_text,
      fetchedAt: options.generatedAt
    });
    return {
      channel: 'rednote',
      runId: options.runId,
      url: record.url,
      title: record.title,
      content: record.snippet ?? record.content ?? '',
      author: record.author,
      authorUrl: record.author_url,
      publishedAt: time.published_at,
      updatedAt: time.updated_at,
      searchQuery: options.searchQuery,
      timeWindowDays: options.timeWindowDays,
      generatedAt: options.generatedAt,
      intent: 'demand',
      metrics: {
        likes: record.likes,
        collects: record.collects,
        comments: record.comments
      },
      tags: record.tags,
      heatScore: heatScore(record),
      raw: {
        ...(record.raw ?? {}),
        rednote_time_text: time.rednote_time_text,
        freshness_days: time.freshness_days,
        freshness_status: time.freshness_status
      }
    };
  }), options.limit);
}

function heatScore(record: RedNoteRecord): number {
  const engagement = (record.likes ?? 0) + (record.collects ?? 0) + (record.comments ?? 0) * 2;
  if (engagement <= 0) return 50;
  return Math.max(50, Math.min(100, 50 + Math.log10(engagement + 1) * 15));
}
