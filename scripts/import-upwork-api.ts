import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { loadDemandRadarEnv } from '../src/config/env.js';
import { searchUpworkApi } from '../src/integrations/upworkApiAdapter.js';

interface Args {
  query: string;
  output: string;
  limit: number;
  filter?: Record<string, unknown>;
  filterPath?: string;
  searchType?: string;
  sortField?: string;
}

loadDemandRadarEnv();

const args = await parseArgs(process.argv.slice(2));
const result = await searchUpworkApi({
  query: args.query,
  limit: args.limit,
  filter: args.filter,
  searchType: args.searchType,
  sortField: args.sortField
});

await mkdir(dirname(args.output), { recursive: true });
await writeFile(args.output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

console.error(`[DemandRadar] Imported ${result.jobs.length} Upwork jobs to ${args.output}`);

async function parseArgs(raw: string[]): Promise<Args> {
  const values = new Map<string, string>();
  for (let index = 0; index < raw.length; index += 1) {
    const key = raw[index];
    if (!key?.startsWith('--')) continue;
    const value = raw[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    values.set(key.slice(2), value);
    index += 1;
  }

  const query = values.get('query');
  if (!query) {
    throw new Error([
      'Usage: npm run upwork:import -- --query <keyword> [--output data/upwork-jobs.json]',
      '[--limit 20] [--filter-json \'{"searchExpression_eq":"..."}\'] [--filter-file filter.json]',
      '[--search-type USER_JOBS_SEARCH] [--sort-field RECENCY]'
    ].join(' '));
  }

  const filterJson = values.get('filter-json');
  const filterPath = values.get('filter-file');
  if (filterJson && filterPath) {
    throw new Error('Use either --filter-json or --filter-file, not both');
  }

  return {
    query,
    output: values.get('output') ?? 'data/upwork-jobs.json',
    limit: parsePositiveInteger(values.get('limit'), 20),
    filter: filterJson ? parseFilterJson(filterJson) : filterPath ? parseFilterJson(await readFile(filterPath, 'utf8')) : undefined,
    filterPath,
    searchType: values.get('search-type'),
    sortField: values.get('sort-field')
  };
}

function parseFilterJson(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Upwork filter JSON must be an object');
  }
  return parsed as Record<string, unknown>;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
