import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { LlmClient } from '../integrations/llmClient.js';
import { SmartSearchClient } from '../integrations/smartSearchClient.js';
import { fixtureData } from '../pipeline/fixtureData.js';
import { runPipeline } from '../pipeline/runPipeline.js';
import { todayUtcDate } from '../time/reportDate.js';

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run the DemandRadar pipeline.')
    .option('--date <date>', 'Report date')
    .option('--fixture', 'Run with injected fixture mode flag')
    .option('--limit <number>', 'Top hotspot limit', '100')
    .option('--db <path>', 'SQLite database path', process.env.DEMANDRADAR_DB_PATH ?? 'data/demandradar.sqlite')
    .option('--reports-dir <path>', 'Reports output directory', process.env.REPORTS_DIR ?? 'reports')
    .option('--briefs-dir <path>', 'Briefs output directory', process.env.BRIEFS_DIR ?? 'briefs')
    .option('--market-batch-size <number>', 'Demand count per market evidence LLM batch', '3')
    .option('--market-concurrency <number>', 'Concurrent market evidence LLM batches', '3')
    .option('--supply-analysis-model <model>', 'Optional stronger LLM model for supply-demand fit analysis', process.env.SUPPLY_ANALYSIS_LLM_MODEL)
    .option('--supply-analysis-limit <number>', 'Top scored demands to analyze with supply-demand fit LLM', '10')
    .option('--rednote-json <path>', 'Import RedNote/Xiaohongshu notes from a JSON file')
    .option('--rednote-query <query>', 'Search query label for imported RedNote records', 'RedNote imported records')
    .option('--skip-smart-search', 'Skip default Smart Search collection')
    .option('--cadence <cadence...>', 'Report cadence(s): daily weekly monthly')
    .option('--locale <locale...>', 'Report locale(s): en zh-CN')
    .action(async (options) => {
      const llmClient = options.fixture ? undefined : new LlmClient();
      const supplyAnalysisLlmClient = options.fixture
        ? undefined
        : options.supplyAnalysisModel
          ? new LlmClient({ model: options.supplyAnalysisModel })
          : llmClient;
      const redNoteRecords = options.rednoteJson ? JSON.parse(await readFile(options.rednoteJson, 'utf8')) : undefined;
      await runPipeline({
        date: options.date ?? todayUtcDate(),
        limit: Number(options.limit),
        fixtureMode: Boolean(options.fixture),
        dbPath: options.db,
        reportsDir: options.reportsDir,
        briefsDir: options.briefsDir,
        marketEvidenceBatchSize: Number(options.marketBatchSize),
        marketEvidenceConcurrency: Number(options.marketConcurrency),
        supplyAnalysisLimit: Number(options.supplyAnalysisLimit),
        cadences: options.cadence,
        locales: options.locale,
        fixtureData: options.fixture ? fixtureData : undefined,
        redNoteRecords,
        redNoteSearchQuery: options.rednoteQuery,
        smartSearchClient: options.fixture || options.skipSmartSearch ? undefined : new SmartSearchClient(),
        llmClient,
        supplyAnalysisLlmClient,
        translationLlm: llmClient
      });
    });
}
