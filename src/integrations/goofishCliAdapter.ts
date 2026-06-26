import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GoofishCliSearchOptions {
  query: string;
  limit: number;
  command?: string;
  commandArgs?: string[];
  timeoutMs?: number;
}

export interface GoofishImportItem {
  platform: 'goofish';
  item_id?: string;
  url?: string;
  title: string;
  description?: string;
  seller?: string;
  seller_id?: string;
  seller_url?: string;
  price?: string | number | null;
  currency?: string;
  location?: string | null;
  city?: string | null;
  condition?: string;
  want_count?: number;
  view_count?: number;
  favorite_count?: number;
  tags?: string[];
  raw: Record<string, unknown>;
}

export interface GoofishCliImportResult {
  items: GoofishImportItem[];
  metadata: {
    provider: 'goofish-cli';
    command: string;
    args: string[];
    query: string;
    limit: number;
    generated_at: string;
  };
}

export async function searchGoofishCli(options: GoofishCliSearchOptions): Promise<GoofishCliImportResult> {
  const command = options.command ?? process.env.GOOFISH_CLI_COMMAND ?? 'goofish';
  const args = buildGoofishSearchArgs(options);
  const { stdout } = await execFileAsync(command, args, {
    timeout: options.timeoutMs ?? 120_000,
    maxBuffer: 10 * 1024 * 1024
  });
  return {
    items: normalizeGoofishCliItems(JSON.parse(stdout)),
    metadata: {
      provider: 'goofish-cli',
      command,
      args,
      query: options.query,
      limit: options.limit,
      generated_at: new Date().toISOString()
    }
  };
}

export function buildGoofishSearchArgs(options: GoofishCliSearchOptions): string[] {
  return [
    ...(options.commandArgs ?? []),
    'search',
    'items',
    options.query,
    '--limit',
    String(options.limit),
    '--format',
    'json'
  ];
}

export function normalizeGoofishCliItems(value: unknown): GoofishImportItem[] {
  return extractItems(value).flatMap((item) => {
    if (!isRecord(item)) return [];
    const title = stringValue(item.title) ?? stringValue(item.name) ?? stringValue(item.subject);
    if (!title) return [];
    const normalized: GoofishImportItem = {
      platform: 'goofish',
      item_id: stringValue(item.item_id) ?? stringValue(item.itemId) ?? stringValue(item.id),
      url: stringValue(item.url) ?? stringValue(item.link),
      title,
      description: stringValue(item.description) ?? stringValue(item.desc) ?? stringValue(item.content) ?? stringValue(item.summary),
      seller: stringValue(item.seller) ?? stringValue(item.seller_nick) ?? stringValue(item.sellerNick) ?? stringValue(item.author),
      seller_id: stringValue(item.seller_id) ?? stringValue(item.sellerId),
      seller_url: stringValue(item.seller_url) ?? stringValue(item.sellerUrl),
      price: stringValue(item.price) ?? numberValue(item.price),
      currency: stringValue(item.currency),
      location: stringValue(item.location) ?? stringValue(item.area),
      city: stringValue(item.city),
      condition: stringValue(item.condition),
      want_count: numberValue(item.want_count) ?? numberValue(item.wantCount),
      view_count: numberValue(item.view_count) ?? numberValue(item.viewCount),
      favorite_count: numberValue(item.favorite_count) ?? numberValue(item.favoriteCount),
      tags: stringArrayValue(item.tags),
      raw: item
    };
    return [normalized];
  });
}

function extractItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  for (const key of ['items', 'listings', 'results', 'data']) {
    const nested = value[key];
    if (Array.isArray(nested)) return nested;
  }
  if (isRecord(value.data)) return extractItems(value.data);
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringArrayValue(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.flatMap((item) => {
    const text = stringValue(item);
    return text ? [text] : [];
  });
  return items.length > 0 ? items : undefined;
}
