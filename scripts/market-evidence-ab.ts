import { performance } from 'node:perf_hooks';
import { loadDemandRadarEnv } from '../src/config/env.js';
import { LlmClient } from '../src/integrations/llmClient.js';
import { researchMarketEvidence, researchMarketEvidenceBatch } from '../src/agents/marketResearcher.js';
import { openDatabase } from '../src/storage/database.js';
import { DemandRadarRepository } from '../src/storage/repositories.js';
import type { Demand, MarketEvidence, Source } from '../src/pipeline/types.js';

interface Args {
  db: string;
  run?: string;
  limit: number;
  batchSize: number;
  concurrency: number;
}

interface StrategyResult {
  strategy: string;
  elapsed_ms: number;
  evidence_count: number;
  covered_demands: number;
  failures: string[];
  fallback_batches?: number;
}

loadDemandRadarEnv();

const args = parseArgs(process.argv.slice(2));
const db = openDatabase(args.db);
const repository = new DemandRadarRepository(db);

try {
  const runId = args.run ?? latestRunId(repository);
  const demands = repository.listDemands(runId, args.limit);
  const sources = repository.listSources(runId);
  if (demands.length === 0) throw new Error(`No demands found for run ${runId}`);
  if (sources.length === 0) throw new Error(`No sources found for run ${runId}`);

  const llm = new LlmClient();
  const generatedAt = new Date().toISOString();
  const single = await timeStrategy('single-concurrent', async () => {
    const settled = await Promise.allSettled(demands.map((demand) => researchMarketEvidence({
      demand,
      sources,
      llm,
      generatedAt
    })));
    return collectSettled(settled);
  });

  let fallbackBatches = 0;
  const batch = await timeStrategy('micro-batch', async () => {
    const settled = await runWithConcurrency(
      chunk(demands, args.batchSize),
      args.concurrency,
      async (batchDemands): Promise<PromiseSettledResult<MarketEvidence[]>> => {
        try {
          return {
            status: 'fulfilled',
            value: await runBatchWithFallback(batchDemands, sources, llm, generatedAt, () => {
              fallbackBatches += 1;
            })
          };
        } catch (reason) {
          return { status: 'rejected', reason };
        }
      }
    );
    return collectSettled(settled);
  });

  const output = {
    run_id: runId,
    demand_count: demands.length,
    source_count: sources.length,
    batch_size: args.batchSize,
    batch_concurrency: args.concurrency,
    results: [
      single,
      { ...batch, fallback_batches: fallbackBatches }
    ]
  };
  console.log(JSON.stringify(output, null, 2));
} finally {
  db.close();
}

async function runBatchWithFallback(
  demands: Demand[],
  sources: Source[],
  llm: LlmClient,
  generatedAt: string,
  onFallback: () => void
): Promise<MarketEvidence[]> {
  try {
    return await researchMarketEvidenceBatch({ demands, sources, llm, generatedAt });
  } catch {
    onFallback();
    return (await Promise.all(demands.map((demand) => researchMarketEvidence({
      demand,
      sources,
      llm,
      generatedAt
    })))).flat();
  }
}

async function timeStrategy(
  strategy: string,
  run: () => Promise<{ evidence: MarketEvidence[]; failures: string[] }>
): Promise<StrategyResult> {
  const started = performance.now();
  const result = await run();
  const elapsed = performance.now() - started;
  return {
    strategy,
    elapsed_ms: Math.round(elapsed),
    evidence_count: result.evidence.length,
    covered_demands: new Set(result.evidence.map((item) => item.demand_id)).size,
    failures: result.failures
  };
}

function collectSettled(settled: PromiseSettledResult<MarketEvidence[]>[]): { evidence: MarketEvidence[]; failures: string[] } {
  const evidence: MarketEvidence[] = [];
  const failures: string[] = [];
  for (const item of settled) {
    if (item.status === 'fulfilled') {
      evidence.push(...item.value);
    } else {
      failures.push(item.reason instanceof Error ? item.reason.message : String(item.reason));
    }
  }
  return { evidence, failures };
}

function latestRunId(repository: DemandRadarRepository): string {
  const runId = repository.getLatestRunId();
  if (!runId) throw new Error('No runs found in database');
  return runId;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index] as T);
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

function parseArgs(raw: string[]): Args {
  const values = new Map<string, string>();
  for (let index = 0; index < raw.length; index += 1) {
    const key = raw[index];
    if (!key?.startsWith('--')) continue;
    const value = raw[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    values.set(key.slice(2), value);
    index += 1;
  }
  const dbPath = values.get('db') ?? process.env.DEMANDRADAR_DB_PATH;
  if (!dbPath) throw new Error('Usage: npm run market:ab -- --db <path> [--run <run-id>] [--limit 10] [--batch-size 3] [--concurrency 3]');
  return {
    db: dbPath,
    run: values.get('run'),
    limit: parsePositiveInteger(values.get('limit'), 10),
    batchSize: parsePositiveInteger(values.get('batch-size'), 3),
    concurrency: parsePositiveInteger(values.get('concurrency'), 3)
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
