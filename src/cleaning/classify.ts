import type { DemandDomain, Hotspot } from '../pipeline/types.js';

const keywordMap: Record<DemandDomain, string[]> = {
  technology: ['developer', 'software', 'github', 'api', 'security', 'cloud', 'startup'],
  consumer: ['consumer', 'shopping', 'creator', 'family', 'health', 'review'],
  policy: ['regulation', 'policy', 'compliance', 'law', 'government', 'tax'],
  social_events: ['trend', 'event', 'community', 'social', 'viral', 'culture'],
  global_expansion: ['cross border', 'global', 'international', 'export', 'localization'],
  ai_applications: ['ai', 'llm', 'agent', 'automation', 'copilot', 'workflow']
};

export function classifyHotspot(hotspot: Hotspot): DemandDomain {
  const text = `${hotspot.title} ${hotspot.summary} ${hotspot.search_query}`.toLowerCase();
  let best: { domain: DemandDomain; score: number } = { domain: hotspot.domain, score: 0 };
  for (const [domain, keywords] of Object.entries(keywordMap) as Array<[DemandDomain, string[]]>) {
    const score = keywords.filter((keyword) => text.includes(keyword)).length;
    if (score > best.score) best = { domain, score };
  }
  return best.domain;
}
