import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { searchFiverrMcp } from '../src/integrations/fiverrMcpAdapter.js';

interface Args {
  query: string;
  output: string;
  limit: number;
  command?: string;
  commandArgs: string[];
  timeoutMs: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sellerLevel?: string;
  sortBy?: string;
}

const args = parseArgs(process.argv.slice(2));
const result = await searchFiverrMcp({
  query: args.query,
  limit: args.limit,
  command: args.command,
  commandArgs: args.commandArgs,
  timeoutMs: args.timeoutMs,
  category: args.category,
  minPrice: args.minPrice,
  maxPrice: args.maxPrice,
  sellerLevel: args.sellerLevel,
  sortBy: args.sortBy
});

await mkdir(dirname(args.output), { recursive: true });
await writeFile(args.output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.error(`[DemandRadar] Imported ${result.gigs.length} Fiverr gigs to ${args.output}`);

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
      'Usage: npm run fiverr:import -- --query <keyword> [--output data/fiverr-gigs.json]',
      '[--limit 20] [--command uvx] [--command-arg fiverr-mcp-server]',
      '[--category programming-tech] [--min-price 50] [--max-price 500]',
      '[--seller-level level_two_seller] [--sort-by best_selling] [--timeout-ms 180000]'
    ].join(' '));
  }

  return {
    query,
    output: values.get('output') ?? 'data/fiverr-gigs.json',
    limit: parsePositiveInteger(values.get('limit'), 20),
    command: values.get('command'),
    commandArgs,
    timeoutMs: parsePositiveInteger(values.get('timeout-ms'), 180_000),
    category: values.get('category'),
    minPrice: parseOptionalPositiveNumber(values.get('min-price')),
    maxPrice: parseOptionalPositiveNumber(values.get('max-price')),
    sellerLevel: values.get('seller-level'),
    sortBy: values.get('sort-by')
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalPositiveNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
