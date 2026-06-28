import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { searchGoofishCli, type GoofishCliImportResult } from '../src/integrations/goofishCliAdapter.js';
import { buildFiverrGigDraftPayloads, renderFiverrGigDrafts } from '../src/reports/fiverrGigDraft.js';
import { openDatabase } from '../src/storage/database.js';
import { DemandRadarRepository } from '../src/storage/repositories.js';

interface Args {
  query: string;
  input?: string;
  output: string;
  limit: number;
  command?: string;
  commandArgs: string[];
  timeoutMs: number;
  marginPercent: number;
  cnyPerUsd: number;
  payoutFeePercent: number;
  fxLossPercent: number;
  dbPath: string;
  persist: boolean;
}

const args = parseArgs(process.argv.slice(2));
const importResult = args.input
  ? JSON.parse(await readFile(args.input, 'utf8')) as GoofishCliImportResult
  : await searchGoofishCli({
    query: args.query,
    limit: args.limit,
    command: args.command,
    commandArgs: args.commandArgs,
    timeoutMs: args.timeoutMs
  });

const markdown = renderFiverrGigDrafts(importResult, {
  query: args.query,
  maxItems: args.limit,
  marginPercent: args.marginPercent,
  cnyPerUsd: args.cnyPerUsd,
  payoutFeePercent: args.payoutFeePercent,
  fxLossPercent: args.fxLossPercent
});

await mkdir(dirname(args.output), { recursive: true });
await writeFile(args.output, `${markdown}\n`, 'utf8');

if (args.persist) {
  const persisted = persistDrafts(importResult);
  console.error(`[DemandRadar] Persisted ${persisted.createdOrUpdated} Fiverr drafts; skipped ${persisted.skippedTerminal} already published/skipped supplies in ${args.dbPath}`);
}

console.error(`[DemandRadar] Exported Fiverr gig drafts for ${importResult.items.length} Goofish items to ${args.output}`);

function persistDrafts(importResult: GoofishCliImportResult): { createdOrUpdated: number; skippedTerminal: number } {
  const db = openDatabase(args.dbPath);
  try {
    const repository = new DemandRadarRepository(db);
    const now = new Date().toISOString();
    const payloads = buildFiverrGigDraftPayloads(importResult, {
      query: args.query,
      maxItems: args.limit,
      marginPercent: args.marginPercent,
      cnyPerUsd: args.cnyPerUsd,
      payoutFeePercent: args.payoutFeePercent,
      fxLossPercent: args.fxLossPercent
    });
    const pricingAssumptions = {
      margin_percent: args.marginPercent,
      cny_per_usd: args.cnyPerUsd,
      payout_fee_percent: args.payoutFeePercent,
      fx_loss_percent: args.fxLossPercent
    };

    let createdOrUpdated = 0;
    let skippedTerminal = 0;
    for (const payload of payloads) {
      const supply = repository.upsertBrokerageSupplyItem({
        platform: 'goofish',
        source_key: payload.source_key,
        source_url: payload.source_url,
        title: payload.item.title,
        seller: payload.item.seller ?? null,
        price: payload.item.price ?? null,
        location: payload.item.location ?? payload.item.city ?? null,
        raw: payload.item.raw,
        seenAt: now
      });

      if (supply.status === 'published' || supply.status === 'skipped') {
        skippedTerminal += 1;
        continue;
      }

      repository.saveFiverrGigDraft({
        supplyItemId: supply.id,
        formFillMap: payload.form_fill_map,
        markdownPath: args.output,
        markdown: payload.markdown,
        assetPaths: [],
        pricingAssumptions,
        now
      });
      createdOrUpdated += 1;
    }
    return { createdOrUpdated, skippedTerminal };
  } finally {
    db.close();
  }
}

function parseArgs(raw: string[]): Args {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const commandArgs: string[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const key = raw[index];
    if (!key?.startsWith('--')) continue;
    if (key === '--no-persist') {
      flags.add(key.slice(2));
      continue;
    }
    const value = raw[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    if (key === '--command-arg') {
      commandArgs.push(value);
    } else {
      values.set(key.slice(2), value);
    }
    index += 1;
  }

  const query = values.get('query');
  const input = values.get('input');
  if (!query) {
    throw new Error([
      'Usage: npm run goofish:fiverr-drafts -- --query <keyword> [--output .tmp/goofish-fiverr/drafts.md]',
      '[--input data/goofish-items.json] [--limit 10] [--margin-percent 40] [--cny-per-usd 7.2]',
      '[--payout-fee-percent 20] [--fx-loss-percent 10]',
      '[--db data/demandradar.sqlite] [--no-persist]',
      '[--command goofish] [--command-arg goofish-cli] [--timeout-ms 120000]'
    ].join(' '));
  }

  return {
    query,
    input,
    output: values.get('output') ?? '.tmp/goofish-fiverr/drafts.md',
    limit: parsePositiveInteger(values.get('limit'), 10),
    command: values.get('command'),
    commandArgs,
    timeoutMs: parsePositiveInteger(values.get('timeout-ms'), 120_000),
    marginPercent: parsePositiveNumber(values.get('margin-percent'), 40),
    cnyPerUsd: parsePositiveNumber(values.get('cny-per-usd'), 7.2),
    payoutFeePercent: parsePercent(values.get('payout-fee-percent'), 20),
    fxLossPercent: parsePercent(values.get('fx-loss-percent'), 10),
    dbPath: values.get('db') ?? process.env.DEMANDRADAR_DB_PATH ?? 'data/demandradar.sqlite',
    persist: !flags.has('no-persist')
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePercent(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed < 100 ? parsed : fallback;
}
