import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { DemandDomain, Hotspot, Source } from '../pipeline/types.js';
import { HotspotSchema, SourceSchema } from '../pipeline/types.js';

export const ChannelNameSchema = z.enum([
  'rednote',
  'goofish',
  'reddit',
  'github',
  'upwork',
  'fiverr'
]);

export const SignalIntentSchema = z.enum(['demand', 'supply', 'both', 'unknown']);

export type ChannelName = z.infer<typeof ChannelNameSchema>;
export type SignalIntent = z.infer<typeof SignalIntentSchema>;

export interface CollectedSignal {
  channel: ChannelName;
  runId: string;
  url: string;
  title: string;
  content: string;
  author?: string;
  authorUrl?: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
  searchQuery: string;
  timeWindowDays: number;
  generatedAt: string;
  intent?: SignalIntent;
  price?: string | number | null;
  location?: string | null;
  metrics?: Record<string, number | undefined>;
  tags?: string[];
  raw?: Record<string, unknown>;
  heatScore?: number;
}

export interface ChannelCollectedResult {
  sources: Source[];
  hotspots: Hotspot[];
}

const channelDomain: Record<ChannelName, DemandDomain> = {
  rednote: 'rednote',
  goofish: 'goofish',
  reddit: 'social_media',
  github: 'technology',
  upwork: 'global_expansion',
  fiverr: 'global_expansion'
};

export function mapSignalsToHotspots(signals: CollectedSignal[], limit?: number): ChannelCollectedResult {
  const selectedSignals = signals.slice(0, limit);
  const sources: Source[] = [];
  const hotspots: Hotspot[] = [];

  for (const signal of selectedSignals) {
    const source = SourceSchema.parse({
      id: `source-${randomUUID()}`,
      run_id: signal.runId,
      source_url: signal.url,
      title: signal.title,
      snippet: signal.content,
      source_name: signal.channel,
      published_at: signal.publishedAt ?? null,
      search_query: signal.searchQuery,
      time_window: `${signal.timeWindowDays}d`,
      raw: {
        ...(signal.raw ?? {}),
        platform: signal.channel,
        channel: signal.channel,
        intent: signal.intent ?? 'unknown',
        author: signal.author,
        author_url: signal.authorUrl,
        updated_at: signal.updatedAt,
        price: signal.price,
        location: signal.location,
        metrics: signal.metrics,
        tags: signal.tags,
        fetched_at: signal.generatedAt
      }
    });
    sources.push(source);
    hotspots.push(HotspotSchema.parse({
      id: `hotspot-${randomUUID()}`,
      run_id: signal.runId,
      title: signal.title,
      summary: signal.content,
      domain: channelDomain[signal.channel],
      source_ids: [source.id],
      canonical_url: signal.url,
      heat_score: signal.heatScore ?? 50,
      search_query: signal.searchQuery,
      time_window: `${signal.timeWindowDays}d`,
      generated_at: signal.generatedAt
    }));
  }

  return { sources, hotspots };
}
