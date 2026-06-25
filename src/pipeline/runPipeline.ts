import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { extractDemands, type DemandExtractionLlm } from '../agents/demandExtractor.js';
import { researchMarketEvidence, researchMarketEvidenceBatch, type MarketResearchLlm } from '../agents/marketResearcher.js';
import { classifyHotspot } from '../cleaning/classify.js';
import { dedupeHotspots } from '../cleaning/dedupe.js';
import { normalizeSource } from '../cleaning/normalize.js';
import { rankHotspots } from '../cleaning/rankHotspots.js';
import type { SmartSearchClient } from '../integrations/smartSearchClient.js';
import { collectHotspots } from '../ingest/hotspotCollector.js';
import { collectRedNoteHotspots } from '../ingest/rednoteCollector.js';
import type { Demand, Hotspot, MarketEvidence, PipelineResult, ReportArtifact, ReportCadence, ReportLocale, Score, Source } from './types.js';
import { HotspotSchema, PipelineResultSchema, ReportArtifactSchema, RunSchema } from './types.js';
import { generateDailyReport } from '../reports/dailyReport.js';
import { generateMiniBrief } from '../reports/miniBrief.js';
import { generateMonthlyReport } from '../reports/monthlyReport.js';
import type { MarkdownTranslationLlm } from '../reports/translateReport.js';
import { generateWeeklyReport } from '../reports/weeklyReport.js';
import { rankDemandScores, scoreOpportunity } from '../scoring/scoreOpportunity.js';
import { openDatabase, type DemandRadarDatabase } from '../storage/database.js';
import { DemandRadarRepository } from '../storage/repositories.js';
import { reportPeriodFor } from '../time/reportDate.js';

export interface RunPipelineOptions {
  date: string;
  limit?: number;
  fixtureMode?: boolean;
  dbPath?: string;
  reportsDir?: string;
  briefsDir?: string;
  smartSearchClient?: Pick<SmartSearchClient, 'exaSearch'>;
  llmClient?: DemandExtractionLlm & MarketResearchLlm;
  repository?: DemandRadarRepository;
  clock?: () => Date;
  marketEvidenceBatchSize?: number;
  marketEvidenceConcurrency?: number;
  cadences?: ReportCadence[];
  locales?: ReportLocale[];
  translationLlm?: MarkdownTranslationLlm;
  fixtureData?: {
    sources: Source[];
    hotspots: Hotspot[];
    demands: Demand[];
    market_evidence: MarketEvidence[];
  };
  redNoteRecords?: unknown;
  redNoteSearchQuery?: string;
}

export async function runPipeline(options: RunPipelineOptions): Promise<PipelineResult> {
  const now = (options.clock?.() ?? new Date()).toISOString();
  const runId = `run-${randomUUID()}`;
  const limit = options.limit ?? 100;
  const reportsDir = options.reportsDir ?? 'reports';
  const briefsDir = options.briefsDir ?? 'briefs';
  const marketEvidenceBatchSize = normalizePositiveInteger(options.marketEvidenceBatchSize, 3);
  const marketEvidenceConcurrency = normalizePositiveInteger(options.marketEvidenceConcurrency, 3);
  const log = (message: string): void => {
    if (!options.fixtureMode) console.error(`[DemandRadar] ${message}`);
  };

  let db: DemandRadarDatabase | undefined;
  const repository = options.repository ?? (() => {
    db = openDatabase(options.dbPath ?? 'data/demandradar.sqlite');
    return new DemandRadarRepository(db);
  })();

  try {
    const run = RunSchema.parse({
      id: runId,
      started_at: now,
      completed_at: now,
      status: 'completed',
      query_window_days: 30,
      top_hotspot_limit: limit,
      metadata: { fixtureMode: options.fixtureMode ?? false }
    });

    log(`Collecting hotspots with concurrent source queries, limit=${limit}`);
    const collected = await collect(options, runId, limit, now);
    const sources = collected.sources.map(normalizeSource);
    const hotspots = rankHotspots(dedupeHotspots(collected.hotspots.map((hotspot) => HotspotSchema.parse({
      ...hotspot,
      domain: classifyHotspot(hotspot)
    }))), limit);
    if (hotspots.length === 0 && !options.fixtureMode) {
      throw new Error('No hotspots collected from live Smart Search run');
    }

    log(`Collected ${sources.length} sources and ${hotspots.length} hotspots`);
    const demands = options.fixtureData?.demands.map((demand) => ({ ...demand, run_id: runId })) ?? (await Promise.all(
      hotspots.map((hotspot) => extractDemands({
        hotspots: [hotspot],
        sources: sources.filter((source) => hotspot.source_ids.includes(source.id)),
        llm: requiredLlm(options),
        generatedAt: now
      }))
    )).flat();
    log(`Extracted ${demands.length} demands from ${hotspots.length} hotspots concurrently`);
    const market_evidence = options.fixtureData?.market_evidence.map((item) => ({ ...item, run_id: runId })) ?? await researchMarketEvidenceInBatches({
      demands,
      sources,
      llm: requiredLlm(options),
      generatedAt: now,
      batchSize: marketEvidenceBatchSize,
      concurrency: marketEvidenceConcurrency,
      onBatchFallback: (error) => log(`Market evidence batch fallback: ${error instanceof Error ? error.message : String(error)}`)
    });
    log(`Researched ${market_evidence.length} market evidence items for ${demands.length} demands with batchSize=${marketEvidenceBatchSize}, concurrency=${marketEvidenceConcurrency}`);

    const scores = rankDemandScores(demands.map((demand) => {
      const evidence = market_evidence.filter((item) => item.demand_id === demand.id);
      return scoreOpportunity(demand, evidence, undefined, now, sources);
    }), 10);
    const reportArtifacts = await writeReports({
      runId,
      date: options.date,
      reportsDir,
      briefsDir,
      demands,
      sources,
      market_evidence,
      scores,
      generatedAt: now,
      cadences: options.cadences ?? ['daily'],
      locales: options.locales ?? ['en']
    });
    log(`Wrote ${reportArtifacts.length} report artifacts`);

    const result = PipelineResultSchema.parse({
      run,
      sources,
      hotspots,
      demands,
      market_evidence,
      scores,
      reports: reportArtifacts
    });
    repository.savePipelineResult(result);
    return result;
  } finally {
    db?.close();
  }
}

async function researchMarketEvidenceInBatches(input: {
  demands: Demand[];
  sources: Source[];
  llm: DemandExtractionLlm & MarketResearchLlm;
  generatedAt: string;
  batchSize: number;
  concurrency: number;
  onBatchFallback?: (error: unknown) => void;
}): Promise<MarketEvidence[]> {
  const batches = chunk(input.demands, input.batchSize);
  const results = await runWithConcurrency(batches, input.concurrency, async (batch) => {
    try {
      return await researchMarketEvidenceBatch({
        demands: batch,
        sources: input.sources,
        llm: input.llm,
        generatedAt: input.generatedAt
      });
    } catch (error) {
      input.onBatchFallback?.(error);
      return (await Promise.all(batch.map((demand) => researchMarketEvidence({
        demand,
        sources: input.sources,
        llm: input.llm,
        generatedAt: input.generatedAt
      })))).flat();
    }
  });
  return results.flat();
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index] as T, index);
    }
  }));
  return results;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isInteger(value) || value <= 0) return fallback;
  return value;
}

async function collect(options: RunPipelineOptions, runId: string, limit: number, generatedAt: string): Promise<{ sources: Source[]; hotspots: Hotspot[] }> {
  if (options.fixtureData) {
    return {
      sources: options.fixtureData.sources.map((source) => ({ ...source, run_id: runId })),
      hotspots: options.fixtureData.hotspots.map((hotspot) => ({ ...hotspot, run_id: runId, generated_at: generatedAt }))
    };
  }

  const collected = { sources: [] as Source[], hotspots: [] as Hotspot[] };

  if (options.smartSearchClient) {
    const web = await collectHotspots({
      runId,
      client: options.smartSearchClient,
      limit,
      timeWindowDays: 30,
      generatedAt
    });
    collected.sources.push(...web.sources);
    collected.hotspots.push(...web.hotspots);
  }

  if (options.redNoteRecords) {
    const rednote = collectRedNoteHotspots({
      runId,
      records: options.redNoteRecords,
      searchQuery: options.redNoteSearchQuery ?? 'RedNote imported records',
      timeWindowDays: 30,
      generatedAt,
      limit
    });
    collected.sources.push(...rednote.sources);
    collected.hotspots.push(...rednote.hotspots);
  }

  if (!options.smartSearchClient && !options.redNoteRecords) {
    throw new Error('runPipeline requires smartSearchClient or redNoteRecords unless fixtureData is provided');
  }

  return collected;
}

async function writeReports(input: {
  runId: string;
  date: string;
  reportsDir: string;
  briefsDir: string;
  demands: Demand[];
  sources: Source[];
  market_evidence: MarketEvidence[];
  scores: Score[];
  generatedAt: string;
  cadences: ReportCadence[];
  locales: ReportLocale[];
  translationLlm?: MarkdownTranslationLlm;
}): Promise<ReportArtifact[]> {
  const artifacts: ReportArtifact[] = [];
  const scoreByDemand = new Map(input.scores.map((score) => [score.demand_id, score]));
  const locales = orderedLocales(unique(input.locales));
  const cadences = unique(input.cadences);
  const topThree = input.scores.slice(0, 3);
  const briefPathsByLocale = new Map<ReportLocale, string[]>();
  const reportIdsByKey = new Map<string, string>();
  const reportsByLocaleAndCadence = new Map<string, ReportArtifact[]>();

  for (const locale of locales) {
    const localizedBriefPaths: string[] = [];
    for (const score of topThree) {
      const demand = input.demands.find((item) => item.id === score.demand_id);
      if (!demand) continue;
      const evidence = input.market_evidence.filter((item) => item.demand_id === demand.id);
      const rendered = generateMiniBrief({ date: input.date, demand, evidence, score, locale });
      const path = join(input.briefsDir, input.date, rendered.path.split('/').pop() ?? 'brief.md');
      await writeMarkdown(path, rendered.markdown);
      localizedBriefPaths.push(rendered.path);
      const key = `brief:${demand.id}:${locale}`;
      const canonicalKey = `brief:${demand.id}:en`;
      const report = await writeReportArtifact({
        runId: input.runId,
        reportType: 'mini_brief',
        cadence: 'daily',
        periodStart: input.date,
        periodEnd: input.date,
        reportsDir: input.briefsDir,
        rendered,
        generatedAt: input.generatedAt,
        locale,
        canonicalReportId: locale === 'en' ? null : reportIdsByKey.get(canonicalKey) ?? null
      });
      artifacts.push(report);
      reportIdsByKey.set(key, report.id);
    }
    briefPathsByLocale.set(locale, localizedBriefPaths);
  }

  for (const cadence of cadences) {
    for (const locale of locales) {
      if (cadence === 'daily') {
        const briefPaths = briefPathsByLocale.get(locale) ?? briefPathsByLocale.get('en') ?? [];
        const daily = generateDailyReport({
          date: input.date,
          scores: input.scores,
          demands: input.demands,
          sources: input.sources,
          evidence: input.market_evidence,
          briefPaths,
          locale
        });
        const report = await writeReportArtifact({
          runId: input.runId,
          reportType: 'daily',
          cadence: 'daily',
          periodStart: input.date,
          periodEnd: input.date,
          reportsDir: input.reportsDir,
          rendered: daily,
          generatedAt: input.generatedAt,
          locale,
          canonicalReportId: locale === 'en' ? null : reportIdsByKey.get(`daily:${input.date}:en`) ?? null
        });
        artifacts.push(report);
        reportIdsByKey.set(`daily:${input.date}:${locale}`, report.id);
        appendLocaleCadenceReport(reportsByLocaleAndCadence, locale, cadence, report);
      }
      if (cadence === 'weekly') {
        const period = reportPeriodFor(input.date, 'weekly');
        const dailyReportsForLocale = reportsByLocaleAndCadence.get(`daily:${locale}`) ?? reportsByLocaleAndCadence.get('daily:en') ?? [];
        const weekly = generateWeeklyReport({
          periodStart: period.start,
          periodEnd: period.end,
          scores: input.scores,
          demands: input.demands,
          evidence: input.market_evidence,
          dailyReports: dailyReportsForLocale,
          locale
        });
        const report = await writeReportArtifact({
          runId: input.runId,
          reportType: 'weekly',
          cadence: 'weekly',
          periodStart: period.start,
          periodEnd: period.end,
          reportsDir: input.reportsDir,
          rendered: weekly,
          generatedAt: input.generatedAt,
          locale,
          canonicalReportId: locale === 'en' ? null : reportIdsByKey.get(`weekly:${period.start}:${period.end}:en`) ?? null
        });
        artifacts.push(report);
        reportIdsByKey.set(`weekly:${period.start}:${period.end}:${locale}`, report.id);
        appendLocaleCadenceReport(reportsByLocaleAndCadence, locale, cadence, report);
      }
      if (cadence === 'monthly') {
        const month = input.date.slice(0, 7);
        const period = reportPeriodFor(input.date, 'monthly');
        const weeklyReportsForLocale = reportsByLocaleAndCadence.get(`weekly:${locale}`) ?? reportsByLocaleAndCadence.get('weekly:en') ?? [];
        const monthly = generateMonthlyReport({
          month,
          weeklyReports: weeklyReportsForLocale,
          locale
        });
        const report = await writeReportArtifact({
          runId: input.runId,
          reportType: 'monthly',
          cadence: 'monthly',
          periodStart: period.start,
          periodEnd: period.end,
          reportsDir: input.reportsDir,
          rendered: monthly,
          generatedAt: input.generatedAt,
          locale,
          canonicalReportId: locale === 'en' ? null : reportIdsByKey.get(`monthly:${month}:en`) ?? null
        });
        artifacts.push(report);
        reportIdsByKey.set(`monthly:${month}:${locale}`, report.id);
        appendLocaleCadenceReport(reportsByLocaleAndCadence, locale, cadence, report);
      }
    }
  }

  for (const score of input.scores) {
    if (!scoreByDemand.has(score.demand_id)) throw new Error(`Missing demand score ${score.demand_id}`);
  }
  return artifacts;
}

async function writeCanonicalReport(input: {
  runId: string;
  reportType: ReportArtifact['report_type'];
  cadence: ReportCadence;
  periodStart: string;
  periodEnd: string;
  reportsDir: string;
  rendered: { path: string; markdown: string; title: string };
  generatedAt: string;
}): Promise<ReportArtifact> {
  return writeReportArtifact({
    runId: input.runId,
    reportType: input.reportType,
    cadence: input.cadence,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    reportsDir: input.reportsDir,
    rendered: input.rendered,
    generatedAt: input.generatedAt,
    locale: 'en',
    canonicalReportId: null
  });
}

async function writeMarkdown(path: string, markdown: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, markdown, 'utf8');
}

async function writeReportArtifact(input: {
  runId: string;
  reportType: ReportArtifact['report_type'];
  cadence: ReportCadence;
  periodStart: string;
  periodEnd: string;
  reportsDir: string;
  rendered: { path: string; markdown: string; title: string };
  generatedAt: string;
  locale: ReportLocale;
  canonicalReportId: string | null;
}): Promise<ReportArtifact> {
  await writeMarkdown(resolveReportPath(input.reportsDir, input.rendered.path), input.rendered.markdown);
  return ReportArtifactSchema.parse({
    id: `report-${randomUUID()}`,
    run_id: input.runId,
    report_type: input.reportType,
    demand_id: null,
    cadence: input.cadence,
    locale: input.locale,
    canonical_report_id: input.canonicalReportId,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    path: input.rendered.path,
    title: input.rendered.title,
    generated_at: input.generatedAt,
    metadata: {}
  });
}

function requiredLlm(options: RunPipelineOptions): DemandExtractionLlm & MarketResearchLlm {
  if (!options.llmClient) throw new Error('runPipeline requires llmClient unless fixtureData is provided');
  return options.llmClient;
}

function resolveReportPath(reportsDir: string, artifactPath: string): string {
  return join(reportsDir, artifactPath.replace(/^reports\//, '').replace(/^briefs\//, ''));
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function orderedLocales(values: ReportLocale[]): ReportLocale[] {
  return values.includes('en') ? ['en', ...values.filter((value) => value !== 'en')] : values;
}

function appendLocaleCadenceReport(
  store: Map<string, ReportArtifact[]>,
  locale: ReportLocale,
  cadence: ReportCadence,
  report: ReportArtifact
): void {
  const key = `${cadence}:${locale}`;
  const list = store.get(key) ?? [];
  list.push(report);
  store.set(key, list);
}
