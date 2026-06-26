import { describe, expect, it } from 'vitest';
import { generateDailyReport } from '../src/reports/dailyReport.js';
import { generateMiniBrief } from '../src/reports/miniBrief.js';
import { generateMonthlyReport } from '../src/reports/monthlyReport.js';
import {
  generateReaderTranslationZhCn,
  needsSimplifiedChineseTranslation,
  translateMarkdownReport
} from '../src/reports/translateReport.js';
import { generateWeeklyReport } from '../src/reports/weeklyReport.js';
import type { Demand, MarketEvidence, ReportArtifact, Score, Source, SupplyDemandAnalysis } from '../src/pipeline/types.js';

const now = '2026-06-18T00:00:00.000Z';

describe('reports', () => {
  it('renders Mini Brief and daily report with deterministic paths and source URLs', () => {
    const demand = fixtureDemand();
    const evidence = [fixtureEvidence(), fixtureCompetitorEvidence()];
    const score = fixtureScore();
    const brief = generateMiniBrief({ date: '2026-06-18', demand, evidence, score });
    const daily = generateDailyReport({
      date: '2026-06-18',
      scores: [score],
      demands: [demand],
      sources: [fixtureSource()],
      evidence,
      briefPaths: [brief.path]
    });

    expect(brief.path).toContain('briefs/2026-06-18/');
    expect(brief.markdown).toContain('https://example.com/report');
    expect(daily.path).toBe('reports/2026-06-18.md');
    expect(daily.markdown).toContain('## Top 10 Demand-Supply Matchups');
    expect(daily.markdown).toContain('| Rank | Demand | Score | Creator-Owned Fit | AI Agent Augmented Fit | External Supply Brokerage Fit | Brokerage Supply Path |');
    expect(daily.markdown).toContain('partial: manual');
    expect(daily.markdown).toContain('AI Agent');
    expect(daily.markdown).toContain('## Top 3 Mini Briefs');
    expect(daily.markdown).toContain('https://example.com/report');
    expect(daily.markdown).toContain('[rednote] Manual research story');
    expect(daily.markdown).toContain('published 2026-06-18');
    expect(daily.markdown).toContain('freshness fresh');
    expect(brief.markdown).toContain('## Supply Fulfillment Path');
    expect(brief.markdown).toContain('Creator-owned fit:');
    expect(brief.markdown).toContain('External supply brokerage fit: partial');
    expect(brief.markdown).toContain('Brokerage supply path:');
    expect(daily.markdown).not.toContain('Useful as leverage for lead capture, structured analysis, prototype generation, and delivery review');
  });

  it('renders zh-CN report surfaces without English template labels', () => {
    const demand = fixtureDemand();
    const evidence = [fixtureEvidence(), fixtureCompetitorEvidence()];
    const score = fixtureScore();
    const brief = generateMiniBrief({ date: '2026-06-18', demand, evidence, score, locale: 'zh-CN' });
    const daily = generateDailyReport({
      date: '2026-06-18',
      scores: [score],
      demands: [demand],
      sources: [fixtureSource()],
      evidence,
      briefPaths: [brief.path],
      locale: 'zh-CN'
    });

    expect(brief.path).toBe('briefs/2026-06-18/automate-opportunity-research.zh-CN.md');
    expect(brief.markdown).toContain('## 供给实现路径');
    expect(brief.markdown).toContain('外部供给撮合匹配：供给部分满足');
    expect(daily.path).toBe('reports/2026-06-18.zh-CN.md');
    expect(daily.markdown).toContain('## 需求-供给匹配前十');
    expect(daily.markdown).toContain('| 排名 | 需求 | 分数 | 个人自营匹配 | AI Agent 增强自营匹配 | 外部供给撮合匹配 | 撮合供给路径 |');
    expect(daily.markdown).not.toContain('## Report Focus');
    expect(daily.markdown).not.toContain('Existing Supply Fit');
    expect(daily.markdown).not.toContain('可作为放大器：用于线索采集、结构化分析、原型生成和交付复核');
    expect(daily.markdown).not.toContain('第三方不是首选；仅在规模化、合规或专业背书不足时补位');
  });

  it('renders structured supply-demand analysis instead of generic fallback text', () => {
    const demand = fixtureDemand();
    const evidence = [fixtureEvidence()];
    const score = fixtureScore();
    const supplyAnalysis = fixtureSupplyAnalysis();
    const brief = generateMiniBrief({
      date: '2026-06-18',
      demand,
      evidence,
      score,
      supplyAnalysis,
      locale: 'zh-CN'
    });
    const daily = generateDailyReport({
      date: '2026-06-18',
      scores: [score],
      demands: [demand],
      sources: [fixtureSource()],
      evidence,
      supplyAnalyses: [supplyAnalysis],
      briefPaths: [brief.path],
      locale: 'zh-CN'
    });

    expect(brief.markdown).toContain('AI 可以汇总小红书和网页证据');
    expect(brief.markdown).toContain('不能替代真实用户访谈');
    expect(brief.markdown).toContain('撮合供给路径：需要撮合：访谈招募服务商');
    expect(daily.markdown).toContain('现有研究工具能收集资料，但不能判断用户是否真的愿意付费');
    expect(daily.markdown).not.toContain('可作为放大器：用于线索采集、结构化分析、原型生成和交付复核');
  });

  it('uses demand id when Mini Brief title has no ASCII slug', () => {
    const demand = {
      ...fixtureDemand(),
      id: 'demand-cn-1',
      demand_statement: '需要一款自动跨平台痛点挖掘工具'
    };
    const brief = generateMiniBrief({
      date: '2026-06-18',
      demand,
      evidence: [fixtureEvidence()],
      score: fixtureScore()
    });

    expect(brief.path).toBe('briefs/2026-06-18/demand-cn-1.md');
  });

  it('renders weekly and monthly rollups with deterministic sections', () => {
    const demand = fixtureDemand();
    const evidence = [fixtureEvidence()];
    const score = fixtureScore();
    const dailyReport = fixtureReport();
    const weekly = generateWeeklyReport({
      periodStart: '2026-06-12',
      periodEnd: '2026-06-18',
      scores: [score, { ...score, id: 'score-2' }],
      demands: [demand],
      evidence,
      dailyReports: [dailyReport]
    });
    const monthly = generateMonthlyReport({
      month: '2026-06',
      weeklyReports: [{ ...dailyReport, report_type: 'weekly', cadence: 'weekly', title: weekly.title, path: weekly.path }]
    });

    expect(weekly.path).toBe('reports/weekly/2026-06-12_to_2026-06-18.en.md');
    expect(weekly.markdown).toContain('## Deduplicated Opportunities');
    expect(weekly.markdown).toContain('https://example.com/report');
    expect(monthly.path).toBe('reports/monthly/2026-06.en.md');
    expect(monthly.markdown).toContain('## Recurring Themes');
    expect(monthly.markdown).toContain('## Investment-Worthy Directions');
  });

  it('preserves product names and keeps source quotes in translation prompts', async () => {
    const messages: unknown[] = [];
    const translated = await translateMarkdownReport({
      title: 'DemandRadar Daily',
      markdown: '# Cursor API\n\n> manual research\n\nhttps://example.com/report',
      terms: ['Cursor', 'API', 'GPT-4'],
      llm: {
        async generateText(input) {
          messages.push(...input);
          return '# Cursor API\n\n> manual research\n\nhttps://example.com/report';
        }
      }
    });

    const serialized = JSON.stringify(messages);
    expect(serialized).toContain('地道的中文母语者日常口语风格');
    expect(serialized).toContain('产品名称');
    expect(serialized).toContain('代码标识符');
    expect(translated).toContain('https://example.com/report');
    expect(translated).toContain('manual research');
  });

  it('returns StoryForge-style zh-CN translation sidecars', async () => {
    const sidecar = await generateReaderTranslationZhCn({
      text: '# Script\n\nEnglish content.',
      process: 'demandradar_report_translation_zh_cn',
      sourceLanguage: 'en',
      llm: {
        async generateText() {
          return '# 脚本\n\n中文内容。';
        }
      }
    });

    expect(sidecar).toMatchObject({
      purpose: 'personal_review_only',
      product_output: false,
      model_source: 'LLM_MODEL',
      prompt_version: 'm37_v2',
      source_language: 'en',
      process: 'demandradar_report_translation_zh_cn',
      zh_cn_text: '# 脚本\n\n中文内容。'
    });
  });

  it('skips reader translation for existing Simplified Chinese and reports LLM errors', async () => {
    const skipped = await generateReaderTranslationZhCn({
      text: '这已经是简体中文内容，应该直接跳过。',
      process: 'demandradar_report_translation_zh_cn',
      sourceLanguage: 'auto',
      skipIfSimplifiedChinese: true
    });
    const failed = await generateReaderTranslationZhCn({
      text: 'English content.',
      process: 'demandradar_report_translation_zh_cn',
      sourceLanguage: 'en',
      llm: {
        async generateText() {
          throw new Error('provider unavailable');
        }
      }
    });

    expect(skipped.skipped).toBe(true);
    expect(skipped.skip_reason).toBe('source_text_already_simplified_chinese');
    expect(failed.translation_error).toContain('provider unavailable');
  });

  it('skips zh-CN translation when Markdown is already Chinese', () => {
    expect(needsSimplifiedChineseTranslation('# 日报\n\n1. 家长需要上门家教服务。')).toBe(false);
    expect(needsSimplifiedChineseTranslation('# Daily\n\nA platform that connects local college students with families seeking tutoring services.')).toBe(true);
  });
});

function fixtureDemand(): Demand {
  return {
    id: 'demand-1',
    run_id: 'run-1',
    hotspot_id: 'hotspot-1',
    user_profile: 'Builder',
    pain_point: 'Research is slow',
    current_alternatives: ['manual'],
    demand_statement: 'Automate opportunity research',
    citations: [{ source_url: 'https://example.com/story', quote: 'manual research' }],
    confidence: 0.8,
    generated_at: now
  };
}

function fixtureEvidence(): MarketEvidence {
  return {
    id: 'evidence-1',
    run_id: 'run-1',
    demand_id: 'demand-1',
    evidence_type: 'tam',
    value: 'large',
    source_url: 'https://example.com/report',
    search_query: 'market',
    time_window: '30d',
    confidence: 0.7,
    generated_at: now
  };
}

function fixtureCompetitorEvidence(): MarketEvidence {
  return {
    ...fixtureEvidence(),
    id: 'evidence-competitor-1',
    evidence_type: 'competitor',
    value: 'Analyst marketplaces and manual research agencies exist but still require manual synthesis',
    source_url: 'https://example.com/competitor'
  };
}

function fixtureSource(): Source {
  return {
    id: 'source-1',
    run_id: 'run-1',
    source_url: 'https://example.com/story',
    title: 'Manual research story',
    snippet: 'manual research',
    source_name: 'rednote',
    published_at: '2026-06-18',
    search_query: 'market',
    time_window: '30d',
    raw: {
      platform: 'rednote',
      updated_at: '2026-06-18T00:00:00.000Z',
      freshness_status: 'fresh'
    }
  };
}

function fixtureScore(): Score {
  return {
    id: 'score-1',
    run_id: 'run-1',
    demand_id: 'demand-1',
    dimension_scores: {
      demand_strength: 80,
      market_size: 70,
      willingness_to_pay: 60,
      feasibility: 90
    },
    total_score: 75,
    explanation: 'source-backed',
    confidence: 0.8,
    generated_at: now
  };
}

function fixtureSupplyAnalysis(): SupplyDemandAnalysis {
  return {
    id: 'supply-analysis-demand-1',
    run_id: 'run-1',
    demand_id: 'demand-1',
    creator_capability_fit: {
      status: 'orchestrate',
      specific_reason: '个人可以搭建机会发现工作流和证据库，但不能单独完成真实付费意愿验证。',
      missing_capability: ['真实用户访谈样本', '垂直行业判断']
    },
    existing_supply_fit: {
      status: 'partial',
      matched_supply: '现有研究工具能收集资料，但不能判断用户是否真的愿意付费',
      unresolved_gap: '缺少把需求证据转成可成交线索的验证环节'
    },
    ai_agent_fill: {
      feasibility: 'medium',
      can_do: ['AI 可以汇总小红书和网页证据', '生成访谈提纲'],
      cannot_do: ['不能替代真实用户访谈'],
      required_inputs: ['目标用户名单', '访谈问题']
    },
    third_party_supply_path: {
      needed: true,
      provider_type: '访谈招募服务商',
      why: '需要接触真实目标用户验证支付意愿。',
      handoff_boundary: 'AI 产出访谈提纲后，由服务商招募并执行访谈。'
    },
    scoring_assessment: {
      demand_strength: 'medium',
      supply_gap: 'clear',
      agent_feasibility: 'medium',
      payment_signal: 'inferred',
      evidence_quality: 'medium'
    },
    confidence: 0.78,
    generated_at: now
  };
}

function fixtureReport(): ReportArtifact {
  return {
    id: 'report-1',
    run_id: 'run-1',
    report_type: 'daily',
    demand_id: null,
    cadence: 'daily',
    locale: 'en',
    canonical_report_id: null,
    period_start: '2026-06-18',
    period_end: '2026-06-18',
    path: 'reports/2026-06-18.md',
    title: 'DemandRadar Daily',
    generated_at: now,
    metadata: {}
  };
}
