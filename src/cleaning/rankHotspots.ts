import type { Hotspot } from '../pipeline/types.js';

export function rankHotspots(hotspots: Hotspot[], limit = 100): Hotspot[] {
  return [...hotspots]
    .sort((a, b) => b.heat_score - a.heat_score || b.source_ids.length - a.source_ids.length || a.title.localeCompare(b.title))
    .slice(0, limit);
}
