import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runPipeline } from '../src/pipeline/runPipeline.js';
import { openDatabase } from '../src/storage/database.js';
import { DemandRadarRepository } from '../src/storage/repositories.js';
import { fixtureData } from './support/pipelineFixture.js';

describe('runPipeline', () => {
  it('persists fixture data and writes report artifacts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'demandradar-'));
    const db = openDatabase(':memory:');
    const repository = new DemandRadarRepository(db);

    const result = await runPipeline({
      date: '2026-06-18',
      limit: 10,
      fixtureMode: true,
      reportsDir: join(dir, 'reports'),
      briefsDir: join(dir, 'briefs'),
      repository,
      fixtureData
    });

    expect(result.reports.some((report) => report.path === 'reports/2026-06-18.md')).toBe(true);
    expect(result.reports.some((report) => report.path === 'reports/2026-06-18.md' && report.cadence === 'daily' && report.locale === 'en')).toBe(true);
    expect(repository.getRunSummary(result.run.id).demand_count).toBeGreaterThan(0);
    db.close();
  });

  it('generates requested rollups and zh-CN variants', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'demandradar-'));
    const db = openDatabase(':memory:');
    const repository = new DemandRadarRepository(db);

    const result = await runPipeline({
      date: '2026-06-18',
      limit: 10,
      fixtureMode: true,
      reportsDir: join(dir, 'reports'),
      briefsDir: join(dir, 'briefs'),
      repository,
      fixtureData,
      cadences: ['daily', 'weekly', 'monthly'],
      locales: ['en', 'zh-CN'],
      translationLlm: {
        async generateText() {
          return '# Translated zh-CN\n\nhttps://example.com/report';
        }
      }
    });

    expect(result.reports.some((report) => report.cadence === 'weekly' && report.locale === 'en')).toBe(true);
    expect(result.reports.some((report) => report.cadence === 'monthly' && report.locale === 'en')).toBe(true);
    expect(result.reports.some((report) => report.locale === 'zh-CN' && report.canonical_report_id)).toBe(true);
    db.close();
  });

  it('generates zh-CN artifacts directly without relying on translation', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'demandradar-'));
    const db = openDatabase(':memory:');
    const repository = new DemandRadarRepository(db);

    const result = await runPipeline({
      date: '2026-06-18',
      fixtureMode: true,
      reportsDir: join(dir, 'reports'),
      briefsDir: join(dir, 'briefs'),
      repository,
      fixtureData: chineseFixtureData(),
      locales: ['en', 'zh-CN'],
      translationLlm: {
        async generateText() {
          throw new Error('translation failed');
        }
      }
    });

    expect(result.reports.some((report) => report.path === 'reports/2026-06-18.md' && report.locale === 'en')).toBe(true);
    expect(result.reports.some((report) => report.path === 'reports/2026-06-18.zh-CN.md' && report.locale === 'zh-CN')).toBe(true);
    db.close();
  });

  it('translates formal zh-CN daily report when rendered content still contains English prose', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'demandradar-'));
    const db = openDatabase(':memory:');
    const repository = new DemandRadarRepository(db);
    const calls: string[] = [];

    await runPipeline({
      date: '2026-06-18',
      fixtureMode: true,
      reportsDir: join(dir, 'reports'),
      briefsDir: join(dir, 'briefs'),
      repository,
      fixtureData: {
        ...fixtureData,
        demands: fixtureData.demands.map((demand) => ({
          ...demand,
          demand_statement: 'Users need a workflow that collects market signals, compares existing vendors, identifies missing supply, prepares buyer-ready options, and coordinates fulfillment without manual research.',
          current_alternatives: [
            'Manual spreadsheets with fragmented screenshots and notes',
            'Generic research tools that do not coordinate supply fulfillment'
          ]
        }))
      },
      locales: ['zh-CN'],
      translationLlm: {
        async generateText(messages) {
          const content = messages.map((message) => message.content).join('\n');
          calls.push(content);
          return content.includes('# DemandRadar 每日报告')
            ? '# 已翻译日报\n\n供给侧内容已转为中文。'
            : '# 已翻译 Brief\n\n供给侧内容已转为中文。';
        }
      }
    });

    const dailyMarkdown = await readFile(join(dir, 'reports', '2026-06-18.zh-CN.md'), 'utf8');
    expect(dailyMarkdown).toContain('# 已翻译日报');
    expect(calls.some((content) => content.includes('地道的中文母语者日常口语风格'))).toBe(true);
    db.close();
  });
});

function chineseFixtureData(): typeof fixtureData {
  return {
    sources: fixtureData.sources.map((source) => ({
      ...source,
      title: '家长需要更快找到靠谱大学生家教',
      snippet: '家长在小红书发帖找大学生上门陪练，要求地点、时间和技能都很明确。',
      raw: {
        platform: 'rednote',
        rednote_time_text: '昨天 23:25 福建'
      }
    })),
    hotspots: fixtureData.hotspots.map((hotspot) => ({
      ...hotspot,
      title: '家长需要更快找到靠谱大学生家教',
      summary: '家长在小红书发帖找大学生上门陪练，要求地点、时间和技能都很明确。'
    })),
    demands: fixtureData.demands.map((demand) => ({
      ...demand,
      user_profile: '同城家长',
      pain_point: '找靠谱大学生家教需要反复筛选和确认时间',
      current_alternatives: ['手动在小红书发帖求推荐', '逐个私信候选老师'],
      demand_statement: '家长需要一个能快速匹配靠谱大学生家教并确认时间地点的工具',
      citations: [{ source_url: 'https://example.com/story', quote: '找大学生上门陪练' }]
    })),
    market_evidence: fixtureData.market_evidence.map((item) => ({
      ...item,
      value: '小红书同城求家教帖子显示家长有明确匹配和信任需求',
      search_query: '同城大学生家教'
    }))
  };
}
