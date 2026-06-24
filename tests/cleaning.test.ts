import { describe, expect, it } from 'vitest';
import { classifyHotspot } from '../src/cleaning/classify.js';
import { dedupeHotspots } from '../src/cleaning/dedupe.js';
import { normalizeSource } from '../src/cleaning/normalize.js';
import { rankHotspots } from '../src/cleaning/rankHotspots.js';
import type { Hotspot, Source } from '../src/pipeline/types.js';

const now = '2026-06-18T00:00:00.000Z';

describe('cleaning utilities', () => {
  it('normalizes source URLs and text fields', () => {
    const source: Source = {
      id: 'source-1',
      run_id: 'run-1',
      source_url: 'https://example.com/story#comments',
      title: '  Example   Story  ',
      snippet: '  Signal   text ',
      source_name: '',
      published_at: null,
      search_query: 'query',
      time_window: '30d',
      raw: {}
    };

    expect(normalizeSource(source)).toMatchObject({
      source_url: 'https://example.com/story',
      title: 'Example Story',
      source_name: 'example.com'
    });
  });

  it('deduplicates and ranks hotspots', () => {
    const hotspots: Hotspot[] = [
      hotspot('h1', 'https://example.com/a', 30),
      hotspot('h2', 'https://example.com/a', 60),
      hotspot('h3', 'https://example.com/b', 90)
    ];
    const deduped = dedupeHotspots(hotspots);
    expect(deduped).toHaveLength(2);
    expect(rankHotspots(deduped)[0]?.id).toBe('h3');
  });

  it('classifies AI application hotspots by keyword', () => {
    expect(classifyHotspot(hotspot('h1', 'https://example.com/a', 50, 'AI agent workflow'))).toBe('ai_applications');
  });

  it('classifies RedNote hotspots by common English names', () => {
    expect(classifyHotspot(hotspot('h1', 'https://example.com/a', 50, 'RedNote creator pain point'))).toBe('rednote');
    expect(classifyHotspot(hotspot('h2', 'https://example.com/b', 50, 'Xiaohongshu user complaint'))).toBe('rednote');
  });
});

function hotspot(id: string, canonical_url: string, heat_score: number, title = 'Startup signal'): Hotspot {
  return {
    id,
    run_id: 'run-1',
    title,
    summary: 'developer workflow automation',
    domain: 'technology',
    source_ids: [`source-${id}`],
    canonical_url,
    heat_score,
    search_query: 'query',
    time_window: '30d',
    generated_at: now
  };
}
