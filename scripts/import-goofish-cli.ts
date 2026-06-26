import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { searchGoofishCli } from '../src/integrations/goofishCliAdapter.js';

interface Args {
  query: string;
  output: string;
  limit: number;
  command?: string;
  commandArgs: string[];
  timeoutMs: number;
}

const args = parseArgs(process.argv.slice(2));
const result = await searchGoofishCli({
  query: args.query,
  limit: args.limit,
  command: args.command,
  commandArgs: args.commandArgs,
  timeoutMs: args.timeoutMs
});

await mkdir(dirname(args.output), { recursive: true });
await writeFile(args.output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.error(`[DemandRadar] Imported ${result.items.length} Goofish items to ${args.output}`);

function parseArgs(raw: string[]): Args {
  const values = new Map<string, string>();
  const commandArgs: string[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const key = raw[index];
    if (!key?.startsWith('--')) continue;
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
  if (!query) {
    throw new Error([
      'Usage: npm run goofish:import -- --query <keyword> [--output data/goofish-items.json]',
      '[--limit 20] [--command goofish] [--command-arg goofish-cli] [--timeout-ms 120000]'
    ].join(' '));
  }

  return {
    query,
    output: values.get('output') ?? 'data/goofish-items.json',
    limit: parsePositiveInteger(values.get('limit'), 20),
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
