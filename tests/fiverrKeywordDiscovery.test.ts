import { describe, expect, it } from 'vitest';
import {
  generateFiverrKeywordCandidates,
  scoreFiverrKeywords,
  selectFiverrKeywordCandidates,
  buildGoofishFiverrFitQueries
} from '../src/ingest/fiverrKeywordDiscovery.js';

describe('fiverrKeywordDiscovery', () => {
  it('generates dynamic combo keywords from stable service anchors', () => {
    const candidates = generateFiverrKeywordCandidates();
    const queries = candidates.map((candidate) => candidate.query);

    expect(queries).toContain('ai automation');
    expect(queries).toContain('n8n ai automation');
    expect(queries).toContain('vapi ai automation');
    expect(queries).toContain('rag chatbot development');
    expect(queries).toContain('geo seo');
  });

  it('rotates candidate selection by rotation key', () => {
    const candidates = generateFiverrKeywordCandidates();
    const first = selectFiverrKeywordCandidates(candidates, { limit: 5, rotationKey: '2026-06-29' });
    const second = selectFiverrKeywordCandidates(candidates, { limit: 5, rotationKey: '2026-06-30' });

    expect(first.map((candidate) => candidate.query)).not.toEqual(second.map((candidate) => candidate.query));
  });

  it('scores market-backed trend keywords above unsupported broad anchors', () => {
    const candidates = generateFiverrKeywordCandidates().filter((candidate) => (
      candidate.query === 'n8n ai automation' || candidate.query === 'logo design'
    ));
    const scored = scoreFiverrKeywords(candidates, {
      searches: [
        {
          query: 'n8n ai automation',
          category: 'ai-services',
          sort_by: 'best_selling',
          total_results: 13_422,
          pages: 1,
          gigs_count: 20,
          top_reviews_count: 455,
          top_seller_levels: ['top_rated_seller', 'level_two_seller'],
          generated_at: '2026-06-29T00:00:00.000Z'
        },
        {
          query: 'logo design',
          category: 'graphics-design',
          sort_by: 'best_selling',
          total_results: 196_032,
          pages: 1,
          gigs_count: 20,
          top_reviews_count: 18_062,
          top_seller_levels: ['top_rated_seller'],
          generated_at: '2026-06-29T00:00:00.000Z'
        }
      ]
    });

    expect(scored[0]?.query).toBe('n8n ai automation');
    expect(scored[0]?.reasons).toContain('balanced_competition');
    expect(scored.find((candidate) => candidate.query === 'logo design')?.reasons).toContain('high_competition');
  });

  it('keeps Goofish service queries rotating without risky resource terms', () => {
    const queries = buildGoofishFiverrFitQueries({ limit: 6, rotationKey: '2026-06-29' });

    expect(queries).toHaveLength(6);
    expect(queries.join(' ')).toMatch(/代做|搭建|接单|定制|优化|剪辑|拍摄/);
    expect(queries.join(' ')).not.toMatch(/课程|模板|网盘|作业|招聘/);
  });
});
