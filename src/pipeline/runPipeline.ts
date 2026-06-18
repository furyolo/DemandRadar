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
import type { Demand, Hotspot, MarketEvidence, PipelineResult, ReportArtifact, Score, Source } from './types.js';
import { HotspotSchema, PipelineResultSchema, ReportArtifactSchema, RunSchema } from './types.js';
import { generateDailyReport } from '../reports/dailyReport.js';
import { generateMiniBrief } from '../reports/miniBrief.js';
import { rankDemandScores, scoreOpportunity } from '../scoring/scoreOpportunity.js';
import { openDatabase, type DemandRadarDatabase } from '../storage/database.js';
import { DemandRadarRepository } from '../storage/repositories.js';

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
  fixtureData?: {
    sources: Source[];
    hotspots: Hotspot[];
    demands: Demand[];
    market_evidence: MarketEvidence[];
  };
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
      return scoreOpportunity(demand, evidence, undefined, now);
    }), 10);
    const reportArtifacts = await writeReports({
      runId,
      date: options.date,
      reportsDir,
      briefsDir,
      demands,
      market_evidence,
      scores,
      generatedAt: now
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
  if (!options.smartSearchClient) {
    throw new Error('runPipeline requires smartSearchClient unless fixtureData is provided');
  }
  return collectHotspots({
    runId,
    client: options.smartSearchClient,
    limit,
    timeWindowDays: 30,
    generatedAt
  });
}

async function writeReports(input: {
  runId: string;
  date: string;
  reportsDir: string;
  briefsDir: string;
  demands: Demand[];
  market_evidence: MarketEvidence[];
  scores: Score[];
  generatedAt: string;
}): Promise<ReportArtifact[]> {
  const artifacts: ReportArtifact[] = [];
  const scoreByDemand = new Map(input.scores.map((score) => [score.demand_id, score]));
  const topThree = input.scores.slice(0, 3);
  const briefPaths: string[] = [];

  for (const score of topThree) {
    const demand = input.demands.find((item) => item.id === score.demand_id);
    if (!demand) continue;
    const evidence = input.market_evidence.filter((item) => item.demand_id === demand.id);
    const rendered = generateMiniBrief({ date: input.date, demand, evidence, score });
    const path = join(input.briefsDir, input.date, rendered.path.split('/').pop() ?? 'brief.md');
    await writeMarkdown(path, rendered.markdown);
    briefPaths.push(rendered.path);
    artifacts.push(ReportArtifactSchema.parse({
      id: `report-${randomUUID()}`,
      run_id: input.runId,
      report_type: 'mini_brief',
      demand_id: demand.id,
      path: rendered.path,
      title: rendered.title,
      generated_at: input.generatedAt
    }));
  }

  const daily = generateDailyReport({
    date: input.date,
    scores: input.scores,
    demands: input.demands,
    evidence: input.market_evidence,
    briefPaths
  });
  await writeMarkdown(join(input.reportsDir, `${input.date}.md`), daily.markdown);
  artifacts.push(ReportArtifactSchema.parse({
    id: `report-${randomUUID()}`,
    run_id: input.runId,
    report_type: 'daily',
    demand_id: null,
    path: daily.path,
    title: daily.title,
    generated_at: input.generatedAt
  }));

  for (const score of input.scores) {
    if (!scoreByDemand.has(score.demand_id)) throw new Error(`Missing demand score ${score.demand_id}`);
  }
  return artifacts;
}

async function writeMarkdown(path: string, markdown: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, markdown, 'utf8');
}

function requiredLlm(options: RunPipelineOptions): DemandExtractionLlm & MarketResearchLlm {
  if (!options.llmClient) throw new Error('runPipeline requires llmClient unless fixtureData is provided');
  return options.llmClient;
}
