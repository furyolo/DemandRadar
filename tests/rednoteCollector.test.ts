import { describe, expect, it } from 'vitest';
import { collectRedNoteHotspots } from '../src/ingest/rednoteCollector.js';

describe('collectRedNoteHotspots', () => {
  it('maps imported RedNote records into sources and hotspots', () => {
    const result = collectRedNoteHotspots({
      runId: 'run-1',
      searchQuery: 'RedNote AI tools',
      timeWindowDays: 30,
      generatedAt: '2026-06-18T00:00:00.000Z',
      records: {
        notes: [
          {
            url: 'https://www.xiaohongshu.com/explore/abc',
            title: 'AI 工具太难用了',
            content: '每天整理需求太痛苦，希望有自动化工具。',
            author: 'creator',
            likes: 100,
            collects: 20,
            comments: 5,
            tags: ['AI', '效率']
          }
        ]
      }
    });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.source_name).toBe('rednote');
    expect(result.sources[0]?.raw).toMatchObject({ platform: 'rednote', author: 'creator' });
    expect(result.hotspots[0]).toMatchObject({ domain: 'rednote', search_query: 'RedNote AI tools' });
    expect(result.hotspots[0]?.heat_score).toBeGreaterThan(50);
  });
});
