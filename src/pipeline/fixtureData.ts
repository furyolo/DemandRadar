import type { Demand, Hotspot, MarketEvidence, Source } from './types.js';

const now = '2026-06-18T00:00:00.000Z';

export const fixtureData: {
  sources: Source[];
  hotspots: Hotspot[];
  demands: Demand[];
  market_evidence: MarketEvidence[];
} = {
  sources: [
    {
      id: 'source-1',
      run_id: 'fixture-run',
      source_url: 'https://example.com/story',
      title: 'Teams need faster opportunity research',
      snippet: 'Builders manually collect signals across communities.',
      source_name: 'Example',
      published_at: null,
      search_query: 'opportunity research',
      time_window: '30d',
      raw: {}
    }
  ],
  hotspots: [
    {
      id: 'hotspot-1',
      run_id: 'fixture-run',
      title: 'Teams need faster opportunity research',
      summary: 'Builders manually collect signals across communities.',
      domain: 'technology',
      source_ids: ['source-1'],
      canonical_url: 'https://example.com/story',
      heat_score: 88,
      search_query: 'opportunity research',
      time_window: '30d',
      generated_at: now
    }
  ],
  demands: [
    {
      id: 'demand-1',
      run_id: 'fixture-run',
      hotspot_id: 'hotspot-1',
      user_profile: 'Indie hacker',
      pain_point: 'Opportunity research is slow and unsystematic',
      current_alternatives: ['Manual search', 'Spreadsheets'],
      demand_statement: 'Automate source-backed opportunity research',
      citations: [{ source_url: 'https://example.com/story', quote: 'manual collection' }],
      confidence: 0.85,
      generated_at: now
    }
  ],
  market_evidence: [
    {
      id: 'evidence-1',
      run_id: 'fixture-run',
      demand_id: 'demand-1',
      evidence_type: 'tam',
      value: 'Large market of builders and product teams',
      source_url: 'https://example.com/report',
      search_query: 'indie hacker product research market',
      time_window: '30d',
      confidence: 0.72,
      generated_at: now
    },
    {
      id: 'evidence-2',
      run_id: 'fixture-run',
      demand_id: 'demand-1',
      evidence_type: 'willingness_to_pay',
      value: 'Existing paid research tools validate budget',
      source_url: 'https://example.com/pricing',
      search_query: 'market research tool pricing',
      time_window: '30d',
      confidence: 0.68,
      generated_at: now
    }
  ]
};
