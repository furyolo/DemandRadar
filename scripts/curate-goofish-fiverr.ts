import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { searchGoofishCli, type GoofishCliImportResult } from '../src/integrations/goofishCliAdapter.js';
import { buildGoofishFiverrFitQueries } from '../src/ingest/fiverrKeywordDiscovery.js';
import { curateGoofishForFiverr } from '../src/reports/goofishFiverrCurate.js';

interface Args {
  queries: string[];
  inputs: string[];
  output: string;
  rejectedOutput: string;
  limitPerQuery: number;
  maxItems: number;
  maxPerCategory: number;
  command?: string;
  commandArgs: string[];
  timeoutMs: number;
}

const args = parseArgs(process.argv.slice(2));
const queries = args.queries.length > 0 || args.inputs.length > 0 ? args.queries : buildGoofishFiverrFitQueries({ rotationKey: new Date() });

const importedInputs = await Promise.all(args.inputs.map(async (inputPath) => {
  return JSON.parse(await readFile(inputPath, 'utf8')) as GoofishCliImportResult;
}));

const liveInputs = [];
for (const query of queries) {
  liveInputs.push(await searchGoofishCli({
    query,
    limit: args.limitPerQuery,
    command: args.command,
    commandArgs: args.commandArgs,
    timeoutMs: args.timeoutMs
  }));
}

const curated = curateGoofishForFiverr([...importedInputs, ...liveInputs], {
  maxItems: args.maxItems,
  maxPerCategory: args.maxPerCategory
});

await mkdir(dirname(args.output), { recursive: true });
await writeFile(args.output, `${JSON.stringify({
  items: curated.items,
  metadata: curated.metadata
}, null, 2)}\n`, 'utf8');

await mkdir(dirname(args.rejectedOutput), { recursive: true });
await writeFile(args.rejectedOutput, `${JSON.stringify({
  rejected: curated.rejected,
  metadata: curated.metadata
}, null, 2)}\n`, 'utf8');

console.error([
  `[DemandRadar] Curated ${curated.items.length} Fiverr-fit Goofish supplies to ${args.output}`,
  `[DemandRadar] Rejected ${curated.rejected.length} records to ${args.rejectedOutput}`,
  `[DemandRadar] Source queries: ${queries.length > 0 ? queries.join(' | ') : '(input only)'}`
].join('\n'));

function parseArgs(raw: string[]): Args {
  const values = new Map<string, string>();
  const queries: string[] = [];
  const inputs: string[] = [];
  const commandArgs: string[] = [];

  for (let index = 0; index < raw.length; index += 1) {
    const key = raw[index];
    if (!key?.startsWith('--')) continue;
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
    output: values.get('output') ?? '.tmp/goofish-fiverr/curated-items.json',
    rejectedOutput: values.get('rejected-output') ?? '.tmp/goofish-fiverr/curated-rejected.json',
    limitPerQuery: parsePositiveInteger(values.get('limit-per-query'), 20),
    maxItems: parsePositiveInteger(values.get('max-items'), 12),
    maxPerCategory: parsePositiveInteger(values.get('max-per-category'), 2),
    command: values.get('command'),
    commandArgs,
    timeoutMs: parsePositiveInteger(values.get('timeout-ms'), 120_000)
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
