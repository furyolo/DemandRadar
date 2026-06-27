import { z } from 'zod';
import type { Hotspot, Source } from '../pipeline/types.js';
import { mapSignalsToHotspots, SignalIntentSchema } from './channelCollector.js';

const UpworkRecordSchema = z.object({
  platform: z.literal('upwork').optional(),
  job_id: z.union([z.string(), z.number()]).optional(),
  id: z.union([z.string(), z.number()]).optional(),
  url: z.string().url().optional(),
  link: z.string().url().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.string().optional(),
  snippet: z.string().optional(),
  client: z.string().optional(),
  client_name: z.string().optional(),
  client_url: z.string().url().optional(),
  published_at: z.string().nullable().optional(),
  posted_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  budget: z.union([z.string(), z.number()]).nullable().optional(),
  hourly_rate: z.union([z.string(), z.number()]).nullable().optional(),
  currency: z.string().optional(),
  location: z.string().nullable().optional(),
  client_country: z.string().nullable().optional(),
  experience_level: z.string().optional(),
  duration: z.string().optional(),
  project_type: z.string().optional(),
  payment_verified: z.boolean().optional(),
  proposal_count: z.number().nonnegative().optional(),
  proposals: z.union([z.string(), z.number()]).optional(),
  client_total_spent: z.union([z.string(), z.number()]).optional(),
  client_rating: z.union([z.string(), z.number()]).optional(),
  skills: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  intent: SignalIntentSchema.optional(),
  raw: z.record(z.string(), z.unknown()).optional()
}).strict();

const UpworkImportSchema = z.union([
  z.array(UpworkRecordSchema),
  z.object({ jobs: z.array(UpworkRecordSchema), metadata: z.record(z.string(), z.unknown()).optional() }).strict(),
  z.object({ items: z.array(UpworkRecordSchema), metadata: z.record(z.string(), z.unknown()).optional() }).strict(),
  z.object({ results: z.array(UpworkRecordSchema), metadata: z.record(z.string(), z.unknown()).optional() }).strict()
]);

export type UpworkRecord = z.infer<typeof UpworkRecordSchema>;

export interface CollectUpworkOptions {
  runId: string;
  records: unknown;
  searchQuery: string;
  timeWindowDays: number;
  generatedAt: string;
  limit?: number;
}

export function collectUpworkHotspots(options: CollectUpworkOptions): { sources: Source[]; hotspots: Hotspot[] } {
  const parsed = UpworkImportSchema.parse(options.records);
  const records = (Array.isArray(parsed) ? parsed : 'jobs' in parsed ? parsed.jobs : 'items' in parsed ? parsed.items : parsed.results)
    .slice(0, options.limit);

  return mapSignalsToHotspots(records.map((record) => {
    const jobId = stringValue(record.job_id ?? record.id);
    const url = record.url ?? record.link ?? (jobId ? `https://www.upwork.com/jobs/${encodeURIComponent(jobId)}` : undefined);
    if (!url) {
      throw new Error('Upwork record requires url, link, job_id, or id');
    }

    return {
      channel: 'upwork',
      runId: options.runId,
      url,
      title: record.title,
      content: record.snippet ?? record.description ?? record.content ?? '',
      author: record.client ?? record.client_name,
      authorUrl: record.client_url,
      publishedAt: record.published_at ?? record.posted_at ?? null,
      updatedAt: record.updated_at ?? null,
      searchQuery: options.searchQuery,
      timeWindowDays: options.timeWindowDays,
      generatedAt: options.generatedAt,
      intent: record.intent ?? 'demand',
      price: record.budget ?? record.hourly_rate,
      location: record.location ?? record.client_country,
      metrics: {
        proposal_count: record.proposal_count ?? numberValue(record.proposals),
        client_total_spent: numberValue(record.client_total_spent),
        client_rating: numberValue(record.client_rating)
      },
      tags: [...(record.skills ?? []), ...(record.tags ?? [])],
      heatScore: heatScore(record),
      raw: {
        ...(record.raw ?? {}),
        job_id: jobId,
        currency: record.currency,
        hourly_rate: record.hourly_rate,
        experience_level: record.experience_level,
        duration: record.duration,
        project_type: record.project_type,
        payment_verified: record.payment_verified,
        proposals: record.proposals
      }
    };
  }), options.limit);
}

function heatScore(record: UpworkRecord): number {
  const paidSignal = record.budget !== undefined || record.hourly_rate !== undefined ? 18 : 8;
  const clientQuality = (record.payment_verified ? 8 : 0) + Math.min(numberValue(record.client_total_spent) ?? 0, 10_000) / 1000;
  const competitionPenalty = Math.min(record.proposal_count ?? numberValue(record.proposals) ?? 0, 50) / 2;
  return Math.max(50, Math.min(100, 55 + paidSignal + clientQuality - competitionPenalty));
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
