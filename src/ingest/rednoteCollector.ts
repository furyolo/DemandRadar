import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Hotspot, Source } from '../pipeline/types.js';
import { HotspotSchema, SourceSchema } from '../pipeline/types.js';

const RedNoteRecordSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  content: z.string().optional(),
  snippet: z.string().optional(),
  author: z.string().optional(),
  author_url: z.string().url().optional(),
  published_at: z.string().nullable().optional(),
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
  const sources: Source[] = [];
  const hotspots: Hotspot[] = [];

  for (const record of records) {
    const source = SourceSchema.parse({
      id: `source-${randomUUID()}`,
      run_id: options.runId,
      source_url: record.url,
      title: record.title,
      snippet: record.snippet ?? record.content ?? '',
      source_name: 'rednote',
      published_at: record.published_at ?? null,
      search_query: options.searchQuery,
      time_window: `${options.timeWindowDays}d`,
      raw: {
        platform: 'rednote',
        author: record.author,
        author_url: record.author_url,
        likes: record.likes,
        collects: record.collects,
        comments: record.comments,
        tags: record.tags,
        ...(record.raw ?? {})
      }
    });
    sources.push(source);
    hotspots.push(HotspotSchema.parse({
      id: `hotspot-${randomUUID()}`,
      run_id: options.runId,
      title: record.title,
      summary: record.snippet ?? record.content ?? '',
      domain: 'rednote',
      source_ids: [source.id],
      canonical_url: record.url,
      heat_score: heatScore(record),
      search_query: options.searchQuery,
      time_window: `${options.timeWindowDays}d`,
      generated_at: options.generatedAt
    }));
  }

  return { sources, hotspots };
}

function heatScore(record: RedNoteRecord): number {
  const engagement = (record.likes ?? 0) + (record.collects ?? 0) + (record.comments ?? 0) * 2;
  if (engagement <= 0) return 50;
  return Math.max(50, Math.min(100, 50 + Math.log10(engagement + 1) * 15));
}
