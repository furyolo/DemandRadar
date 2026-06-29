import { spawn } from 'node:child_process';

interface Args {
  queries: string[];
  inputs: string[];
  curatedOutput: string;
  rejectedOutput: string;
  draftOutput: string;
  draftQuery: string;
  limitPerQuery: number;
  maxItems: number;
  maxPerCategory: number;
  command?: string;
  commandArgs: string[];
  timeoutMs: number;
  marginPercent: number;
  minSourceMultiple: number;
  cnyPerUsd: number;
  payoutFeePercent: number;
  fxLossPercent: number;
  dbPath?: string;
  persist: boolean;
}

const args = parseArgs(process.argv.slice(2));

await runTsScript('goofish:fiverr-curate', 'scripts/curate-goofish-fiverr.ts', buildCurateArgs(args));
await runTsScript('goofish:fiverr-drafts', 'scripts/export-goofish-fiverr-drafts.ts', buildDraftArgs(args));

console.error([
  '[DemandRadar] Goofish-to-Fiverr default workflow completed.',
  `[DemandRadar] Curated supply JSON: ${args.curatedOutput}`,
  `[DemandRadar] Rejected supply JSON: ${args.rejectedOutput}`,
  `[DemandRadar] Fiverr draft Markdown: ${args.draftOutput}`
].join('\n'));

function buildCurateArgs(args: Args): string[] {
  return [
    ...args.queries.flatMap((query) => ['--query', query]),
    ...args.inputs.flatMap((input) => ['--input', input]),
    '--output',
    args.curatedOutput,
    '--rejected-output',
    args.rejectedOutput,
    '--limit-per-query',
    String(args.limitPerQuery),
    '--max-items',
    String(args.maxItems),
    '--max-per-category',
    String(args.maxPerCategory),
    ...optionalPair('--command', args.command),
    ...args.commandArgs.flatMap((commandArg) => ['--command-arg', commandArg]),
    '--timeout-ms',
    String(args.timeoutMs)
  ];
}

function buildDraftArgs(args: Args): string[] {
  return [
    '--query',
    args.draftQuery,
    '--input',
    args.curatedOutput,
    '--limit',
    String(args.maxItems),
    '--output',
    args.draftOutput,
    '--margin-percent',
    String(args.marginPercent),
    '--min-source-multiple',
    String(args.minSourceMultiple),
    '--cny-per-usd',
    String(args.cnyPerUsd),
    '--payout-fee-percent',
    String(args.payoutFeePercent),
    '--fx-loss-percent',
    String(args.fxLossPercent),
    ...optionalPair('--db', args.dbPath),
    ...args.persist ? [] : ['--no-persist']
  ];
}

function parseArgs(raw: string[]): Args {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const queries: string[] = [];
  const inputs: string[] = [];
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
    if (key === '--query') {
      queries.push(value);
    } else if (key === '--input') {
      inputs.push(value);
    } else if (key === '--command-arg') {
      commandArgs.push(value);
    } else {
      values.set(key.slice(2), value);
    }
    index += 1;
  }

  return {
    queries,
    inputs,
    curatedOutput: values.get('curated-output') ?? '.tmp/goofish-fiverr/curated-items.json',
    rejectedOutput: values.get('rejected-output') ?? '.tmp/goofish-fiverr/curated-rejected.json',
    draftOutput: values.get('draft-output') ?? values.get('output') ?? '.tmp/goofish-fiverr/curated-drafts.md',
    draftQuery: values.get('draft-query') ?? '精选可交付供给',
    limitPerQuery: parsePositiveInteger(values.get('limit-per-query'), 20),
    maxItems: parsePositiveInteger(values.get('max-items') ?? values.get('limit'), 12),
    maxPerCategory: parsePositiveInteger(values.get('max-per-category'), 2),
    command: values.get('command'),
    commandArgs,
    timeoutMs: parsePositiveInteger(values.get('timeout-ms'), 120_000),
    marginPercent: parsePositiveNumber(values.get('margin-percent'), 40),
    minSourceMultiple: parsePositiveNumber(values.get('min-source-multiple'), 10),
    cnyPerUsd: parsePositiveNumber(values.get('cny-per-usd'), 7.2),
    payoutFeePercent: parsePercent(values.get('payout-fee-percent'), 20),
    fxLossPercent: parsePercent(values.get('fx-loss-percent'), 10),
    dbPath: values.get('db'),
    persist: !flags.has('no-persist')
  };
}

async function runTsScript(label: string, scriptPath: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', scriptPath, ...args], {
      stdio: 'inherit',
      env: process.env
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} exited with code ${code ?? 'unknown'}`));
    });
  });
}

function optionalPair(key: string, value: string | undefined): string[] {
  return value ? [key, value] : [];
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
