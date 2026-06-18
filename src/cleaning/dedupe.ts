import type { Hotspot } from '../pipeline/types.js';
import { HotspotSchema } from '../pipeline/types.js';

export function dedupeHotspots(hotspots: Hotspot[]): Hotspot[] {
  const merged = new Map<string, Hotspot>();
  for (const hotspot of hotspots) {
    const key = hotspot.canonical_url ?? normalizedTitleKey(hotspot.title);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, hotspot);
      continue;
    }
    merged.set(key, HotspotSchema.parse({
      ...existing,
      source_ids: Array.from(new Set([...existing.source_ids, ...hotspot.source_ids])),
      heat_score: Math.min(100, Math.max(existing.heat_score, hotspot.heat_score) + 10),
      summary: existing.summary.length >= hotspot.summary.length ? existing.summary : hotspot.summary
    }));
  }
  return Array.from(merged.values());
}

function normalizedTitleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
