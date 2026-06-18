import { randomUUID } from 'node:crypto';
import type { SmartSearchClient, SmartSearchCommandResult } from '../integrations/smartSearchClient.js';
import type { Hotspot, Source } from '../pipeline/types.js';
import { HotspotSchema, SourceSchema } from '../pipeline/types.js';
import { buildSourceQueries } from './sourceQueries.js';

export interface CollectHotspotsOptions {
  runId: string;
  client: Pick<SmartSearchClient, 'search' | 'exaSearch'>;
  limit?: number;
  timeWindowDays?: number;
  generatedAt?: string;
}

export async function collectHotspots(options: CollectHotspotsOptions): Promise<{ sources: Source[]; hotspots: Hotspot[] }> {
  const limit = options.limit ?? 100;
  const timeWindowDays = options.timeWindowDays ?? 30;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const perQueryLimit = Math.max(3, Math.ceil(limit / buildSourceQueries(timeWindowDays).length));
  const sources: Source[] = [];
  const hotspots: Hotspot[] = [];

  for (const sourceQuery of buildSourceQueries(timeWindowDays)) {
    const result = await options.client.search(sourceQuery.query, { limit: perQueryLimit, timeWindowDays });
    const records = extractRecords(result).slice(0, perQueryLimit);
    for (const record of records) {
      const source = SourceSchema.parse({
        id: `source-${randomUUID()}`,
        run_id: options.runId,
        source_url: record.url,
        title: record.title,
        snippet: record.snippet,
        source_name: record.source_name,
        published_at: record.published_at,
        search_query: sourceQuery.query,
        time_window: `${timeWindowDays}d`,
        raw: record.raw
      });
      sources.push(source);
      hotspots.push(HotspotSchema.parse({
        id: `hotspot-${randomUUID()}`,
        run_id: options.runId,
        title: source.title,
        summary: source.snippet,
        domain: sourceQuery.domain,
        source_ids: [source.id],
        canonical_url: source.source_url,
        heat_score: 50,
        search_query: sourceQuery.query,
        time_window: `${timeWindowDays}d`,
        generated_at: generatedAt
      }));
      if (hotspots.length >= limit) return { sources, hotspots };
    }
  }

  return { sources, hotspots };
}

interface SearchRecord {
  url: string;
  title: string;
  snippet: string;
  source_name: string;
  published_at: string | null;
  raw: Record<string, unknown>;
}

function extractRecords(result: SmartSearchCommandResult): SearchRecord[] {
  const value = result.parsed;
  const items = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.results)
      ? value.results
      : isRecord(value) && Array.isArray(value.data)
        ? value.data
        : [];

  return items.flatMap((item): SearchRecord[] => {
    if (!isRecord(item)) return [];
    const url = stringValue(item.url) ?? stringValue(item.link);
    const title = stringValue(item.title) ?? stringValue(item.name);
    if (!url || !title) return [];
    return [{
      url,
      title,
      snippet: stringValue(item.snippet) ?? stringValue(item.text) ?? stringValue(item.summary) ?? '',
      source_name: stringValue(item.source) ?? hostname(url),
      published_at: stringValue(item.published_at) ?? stringValue(item.publishedDate) ?? null,
      raw: item
    }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}
