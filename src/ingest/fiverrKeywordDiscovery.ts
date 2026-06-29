import type { FiverrMcpImportResult, FiverrMcpSearchSummary } from '../integrations/fiverrMcpAdapter.js';

export interface FiverrKeywordSeed {
  core: string;
  category: string;
  modifiers: string[];
  scenarios?: string[];
}

export interface FiverrKeywordCandidate {
  query: string;
  category: string;
  core: string;
  source: 'core' | 'modifier' | 'scenario';
}

export interface ScoredFiverrKeyword extends FiverrKeywordCandidate {
  score: number;
  reasons: string[];
  market?: FiverrMcpSearchSummary;
}

export interface KeywordSelectionOptions {
  limit?: number;
  rotationKey?: string | Date;
}

const DEFAULT_LIMIT = 24;
const trendTerms = /\b(n8n|vapi|rag|geo|aeo|ugc|botpress|make|zapier|ai agent|voice agent|whatsapp|shopify|gohighlevel)\b/i;
const riskyTerms = /\b(course|template|homework|exam|recruiting|job|bundle|download|source code pack)\b|课程|教程|模板|网盘|作业|考试|招聘|源码合集|资料包/i;
const deliverableTerms = /\b(design|develop|build|setup|automation|workflow|chatbot|agent|website|seo|video|editing|resume|business plan|voice over|ads|integration)\b/i;

export const DEFAULT_FIVERR_KEYWORD_SEEDS: FiverrKeywordSeed[] = [
  {
    core: 'ai automation',
    category: 'ai-services',
    modifiers: ['n8n', 'make', 'zapier', 'vapi', 'botpress', 'rag chatbot', 'ai agent', 'voice agent'],
    scenarios: ['shopify', 'lead generation', 'customer support', 'whatsapp', 'crm', 'gohighlevel']
  },
  {
    core: 'chatbot development',
    category: 'ai-services',
    modifiers: ['rag', 'botpress', 'voiceflow', 'dialogflow', 'openai', 'custom knowledge base'],
    scenarios: ['website', 'whatsapp', 'shopify', 'saas']
  },
  {
    core: 'wordpress website',
    category: 'programming-tech',
    modifiers: ['elementor', 'woocommerce', 'bug fix', 'speed optimization', 'migration'],
    scenarios: ['business website', 'landing page', 'membership website']
  },
  {
    core: 'shopify website',
    category: 'programming-tech',
    modifiers: ['dropshipping', 'store redesign', 'theme customization', 'product upload', 'automation'],
    scenarios: ['ecommerce', 'print on demand', 'one product store']
  },
  {
    core: 'seo',
    category: 'digital-marketing',
    modifiers: ['local seo', 'technical seo', 'backlinks', 'geo', 'aeo', 'ai search'],
    scenarios: ['google ranking', 'gmb', 'shopify', 'wordpress']
  },
  {
    core: 'ugc video',
    category: 'video-animation',
    modifiers: ['tiktok ads', 'instagram reels', 'product demo', 'spokesperson', 'amazon influencer'],
    scenarios: ['beauty brand', 'saas', 'shopify product']
  },
  {
    core: 'video editing',
    category: 'video-animation',
    modifiers: ['youtube shorts', 'podcast', 'talking head', 'wedding', 'gaming'],
    scenarios: ['tiktok', 'reels', 'ads']
  },
  {
    core: 'logo design',
    category: 'graphics-design',
    modifiers: ['minimalist', 'brand identity', 'hand drawn', 'app icon', '3d'],
    scenarios: ['startup', 'business', 'ecommerce']
  },
  {
    core: 'resume writing',
    category: 'writing-translation',
    modifiers: ['ats', 'linkedin', 'cover letter', 'executive', 'tech resume'],
    scenarios: ['cybersecurity', 'software engineer', 'healthcare']
  },
  {
    core: 'business plan',
    category: 'business',
    modifiers: ['financial model', 'pitch deck', 'investor ready', 'grant proposal', 'sba loan'],
    scenarios: ['startup', 'restaurant', 'nonprofit']
  }
];

export const DEFAULT_GOOFISH_FIVERR_QUERY_SEEDS = [
  'n8n 自动化 代做',
  'AI 智能体 工作流 代做',
  'Vapi 语音智能体 搭建',
  'RAG 知识库 聊天机器人 定制',
  'Shopify 网站 搭建',
  'WordPress 网站 搭建',
  'GEO AEO SEO 优化',
  'UGC 视频 广告 拍摄',
  '短视频 剪辑 接单',
  'logo 设计 接单',
  'PPT 美化 代做',
  'Power BI 可视化 看板 代做'
];

export function generateFiverrKeywordCandidates(seeds: FiverrKeywordSeed[] = DEFAULT_FIVERR_KEYWORD_SEEDS): FiverrKeywordCandidate[] {
  const candidates: FiverrKeywordCandidate[] = [];
  for (const seed of seeds) {
    candidates.push({ query: seed.core, category: seed.category, core: seed.core, source: 'core' });
    for (const modifier of seed.modifiers) {
      candidates.push({
        query: normalizeQuery(`${modifier} ${seed.core}`),
        category: seed.category,
        core: seed.core,
        source: 'modifier'
      });
    }
    for (const scenario of seed.scenarios ?? []) {
      candidates.push({
        query: normalizeQuery(`${scenario} ${seed.core}`),
        category: seed.category,
        core: seed.core,
        source: 'scenario'
      });
    }
  }
  return dedupeCandidates(candidates);
}

export function selectFiverrKeywordCandidates(
  candidates = generateFiverrKeywordCandidates(),
  options: KeywordSelectionOptions = {}
): FiverrKeywordCandidate[] {
  const limit = normalizeLimit(options.limit, DEFAULT_LIMIT);
  const rotated = rotate(candidates, rotationOffset(options.rotationKey));
  return rotated.slice(0, limit);
}

export function buildGoofishFiverrFitQueries(options: KeywordSelectionOptions = {}): string[] {
  const limit = normalizeLimit(options.limit, DEFAULT_GOOFISH_FIVERR_QUERY_SEEDS.length);
  return rotate(DEFAULT_GOOFISH_FIVERR_QUERY_SEEDS, rotationOffset(options.rotationKey)).slice(0, limit);
}

export function scoreFiverrKeywords(
  candidates: FiverrKeywordCandidate[],
  importResult?: Pick<FiverrMcpImportResult, 'searches'>
): ScoredFiverrKeyword[] {
  const marketByQuery = new Map((importResult?.searches ?? []).map((search) => [search.query.toLowerCase(), search]));
  return candidates
    .map((candidate) => scoreCandidate(candidate, marketByQuery.get(candidate.query.toLowerCase())))
    .sort((left, right) => right.score - left.score || left.query.localeCompare(right.query));
}

function scoreCandidate(candidate: FiverrKeywordCandidate, market: FiverrMcpSearchSummary | undefined): ScoredFiverrKeyword {
  const reasons: string[] = [];
  let score = candidate.source === 'core' ? 45 : 50;

  if (trendTerms.test(candidate.query)) {
    score += 15;
    reasons.push('trend_modifier');
  }
  if (deliverableTerms.test(candidate.query)) {
    score += 8;
    reasons.push('clear_service_deliverable');
  }
  if (riskyTerms.test(candidate.query)) {
    score -= 35;
    reasons.push('risk_term');
  }
  if (market?.total_results !== undefined) {
    score += demandScore(market.total_results);
    reasons.push(`total_results:${market.total_results}`);
    if (market.total_results > 50_000) {
      score -= 18;
      reasons.push('high_competition');
    } else if (market.total_results >= 2_000 && market.total_results <= 30_000) {
      score += 10;
      reasons.push('balanced_competition');
    } else if (market.total_results < 200) {
      score -= 8;
      reasons.push('thin_market');
    }
  }
  if (market?.top_reviews_count !== undefined) {
    score += Math.min(12, Math.log10(market.top_reviews_count + 1) * 4);
    reasons.push(`top_reviews:${market.top_reviews_count}`);
  }
  if (market?.top_seller_levels.some((level) => /top_rated|level_two/i.test(level))) {
    score += 6;
    reasons.push('mature_seller_signal');
  }

  return {
    ...candidate,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    market
  };
}

function demandScore(totalResults: number): number {
  return Math.min(18, Math.log10(totalResults + 1) * 4);
}

function dedupeCandidates(candidates: FiverrKeywordCandidate[]): FiverrKeywordCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.query.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function rotate<T>(items: T[], offset: number): T[] {
  if (items.length === 0) return [];
  const normalized = offset % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

function rotationOffset(value: string | Date | undefined): number {
  const key = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (!key) return 0;
  return Array.from(key).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
