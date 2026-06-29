import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';

export interface FiverrMcpSearchOptions {
  query: string;
  limit: number;
  command?: string;
  commandArgs?: string[];
  timeoutMs?: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sellerLevel?: string;
  sortBy?: string;
}

export interface FiverrImportGig {
  platform: 'fiverr';
  record_type: 'gig';
  gig_id?: string;
  gig_url?: string;
  url?: string;
  title: string;
  description?: string;
  snippet?: string;
  seller_name?: string;
  seller_url?: string;
  price?: string | number | null;
  min_price?: string | number | null;
  max_price?: string | number | null;
  currency?: string;
  seller_level?: string;
  rating?: string | number;
  reviews_count?: number;
  orders_in_queue?: number;
  delivery_time?: string;
  category?: string;
  tags?: string[];
  raw: Record<string, unknown>;
}

export interface FiverrMcpImportResult {
  gigs: FiverrImportGig[];
  searches: FiverrMcpSearchSummary[];
  metadata: {
    provider: 'fiverr-mcp-server';
    command: string;
    args: string[];
    query: string;
    limit: number;
    generated_at: string;
  };
}

export interface FiverrMcpSearchSummary {
  query: string;
  category?: string;
  sort_by?: string;
  total_results?: number;
  pages: number;
  gigs_count: number;
  top_reviews_count?: number;
  top_seller_levels: string[];
  generated_at: string;
}

interface JsonRpcResponse {
  id?: number;
  result?: unknown;
  error?: { message?: string; code?: number; data?: unknown };
}

export async function searchFiverrMcp(options: FiverrMcpSearchOptions): Promise<FiverrMcpImportResult> {
  const command = options.command ?? process.env.FIVERR_MCP_COMMAND ?? 'uvx';
  const args = buildFiverrMcpServerArgs(options);
  const client = new StdioMcpClient(command, args, options.timeoutMs ?? 180_000);

  try {
    await client.start();
    await client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'demandradar-fiverr-import', version: '0.1.0' }
    });
    client.notify('notifications/initialized', {});

    const gigs: FiverrImportGig[] = [];
    const pagePayloads: unknown[] = [];
    let page = 1;
    let hasMore = true;
    while (gigs.length < options.limit && hasMore) {
      const response = await client.request('tools/call', {
        name: 'search_gigs',
        arguments: buildFiverrSearchArguments(options, page)
      });
      const parsed = extractMcpToolPayload(response);
      pagePayloads.push(parsed);
      const pageGigs = normalizeFiverrMcpGigs(parsed);
      gigs.push(...pageGigs);
      hasMore = (isRecord(parsed) ? booleanValue(getByKeys(parsed, ['has_more', 'hasMore'])) : undefined) ?? pageGigs.length > 0;
      page += 1;
      if (pageGigs.length === 0) break;
    }

    return {
      gigs: gigs.slice(0, options.limit),
      searches: [summarizeFiverrSearch(options, pagePayloads, gigs.slice(0, options.limit))],
      metadata: {
        provider: 'fiverr-mcp-server',
        command,
        args,
        query: options.query,
        limit: options.limit,
        generated_at: new Date().toISOString()
      }
    };
  } finally {
    await client.close();
  }
}

export function buildFiverrMcpServerArgs(options: FiverrMcpSearchOptions): string[] {
  return options.commandArgs && options.commandArgs.length > 0 ? options.commandArgs : ['fiverr-mcp-server'];
}

function summarizeFiverrSearch(options: FiverrMcpSearchOptions, pagePayloads: unknown[], gigs: FiverrImportGig[]): FiverrMcpSearchSummary {
  const totalResults = pagePayloads
    .map((payload) => isRecord(payload) ? numberValue(getByKeys(payload, ['total_results', 'totalResults', 'total'])) : undefined)
    .find((value) => value !== undefined);
  const topReviews = gigs.reduce<number | undefined>((current, gig) => {
    if (gig.reviews_count === undefined) return current;
    return current === undefined ? gig.reviews_count : Math.max(current, gig.reviews_count);
  }, undefined);
  const topSellerLevels = Array.from(new Set(gigs.flatMap((gig) => gig.seller_level ? [gig.seller_level] : []))).slice(0, 5);

  return {
    query: options.query,
    category: options.category,
    sort_by: options.sortBy,
    total_results: totalResults,
    pages: pagePayloads.length,
    gigs_count: gigs.length,
    top_reviews_count: topReviews,
    top_seller_levels: topSellerLevels,
    generated_at: new Date().toISOString()
  };
}

export function buildFiverrSearchArguments(options: FiverrMcpSearchOptions, page = 1): Record<string, unknown> {
  return dropUndefined({
    query: options.query,
    category: options.category,
    min_price: options.minPrice,
    max_price: options.maxPrice,
    seller_level: options.sellerLevel,
    sort_by: options.sortBy,
    page
  });
}

export function normalizeFiverrMcpGigs(value: unknown): FiverrImportGig[] {
  return extractItems(value).flatMap((item) => {
    if (!isRecord(item)) return [];
    const title = stringValue(getByKeys(item, ['title', 'gig_title', 'name']));
    if (!title) return [];

    const url = stringValue(getByKeys(item, ['url', 'gig_url', 'gigUrl', 'link']));
    const sellerName = stringValue(getByKeys(item, ['seller_name', 'sellerName', 'seller', 'username']));
    const normalized: FiverrImportGig = {
      platform: 'fiverr',
      record_type: 'gig',
      gig_id: stringValue(getByKeys(item, ['gig_id', 'gigId', 'id'])),
      gig_url: url,
      url,
      title,
      description: stringValue(getByKeys(item, ['description', 'desc'])),
      snippet: stringValue(getByKeys(item, ['snippet', 'summary', 'short_description', 'shortDescription'])),
      seller_name: sellerName,
      seller_url: stringValue(getByKeys(item, ['seller_url', 'sellerUrl'])) ?? (sellerName ? `https://www.fiverr.com/${encodeURIComponent(sellerName)}` : undefined),
      price: getPriceValue(item, ['price', 'starting_price', 'startingPrice']),
      min_price: getPriceValue(item, ['min_price', 'minPrice']),
      max_price: getPriceValue(item, ['max_price', 'maxPrice']),
      currency: stringValue(getByKeys(item, ['currency'])) ?? 'USD',
      seller_level: stringValue(getByKeys(item, ['seller_level', 'sellerLevel', 'level'])),
      rating: numberValue(getByKeys(item, ['rating', 'seller_rating', 'sellerRating'])) ?? stringValue(getByKeys(item, ['rating', 'seller_rating', 'sellerRating'])),
      reviews_count: numberValue(getByKeys(item, ['reviews_count', 'reviewsCount', 'review_count', 'reviewCount', 'reviews'])),
      orders_in_queue: numberValue(getByKeys(item, ['orders_in_queue', 'ordersInQueue'])),
      delivery_time: stringValue(getByKeys(item, ['delivery_time', 'deliveryTime'])),
      category: stringValue(getByKeys(item, ['category', 'category_name', 'categoryName'])),
      tags: stringArrayValue(getByKeys(item, ['tags'])),
      raw: item
    };
    return [normalized];
  });
}

function extractMcpToolPayload(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const structuredContent = value.structuredContent;
  if (structuredContent !== undefined) return structuredContent;
  const content = value.content;
  if (!Array.isArray(content)) return value;
  for (const item of content) {
    if (!isRecord(item)) continue;
    const text = stringValue(item.text);
    if (!text) continue;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { results: [{ title: text, snippet: text }] };
    }
  }
  return value;
}

function extractItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  for (const key of ['gigs', 'items', 'results', 'data']) {
    const nested = value[key];
    if (Array.isArray(nested)) return nested;
  }
  if (isRecord(value.data)) return extractItems(value.data);
  if (isRecord(value.result)) return extractItems(value.result);
  return [];
}

function getPriceValue(record: Record<string, unknown>, keys: string[]): string | number | null | undefined {
  const value = getByKeys(record, keys);
  if (typeof value === 'number') return numberValue(value);
  return stringValue(value) ?? numberValue(value) ?? nullValue(value);
}

function getByKeys(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

function dropUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
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

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function nullValue(value: unknown): null | undefined {
  return value === null ? null : undefined;
}

function stringArrayValue(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.flatMap((item) => {
    const text = stringValue(item);
    return text ? [text] : [];
  });
  return items.length > 0 ? items : undefined;
}

class StdioMcpClient {
  private child?: ReturnType<typeof spawn>;
  private nextId = 1;
  private pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  private stderr = '';

  constructor(
    private readonly command: string,
    private readonly args: string[],
    private readonly timeoutMs: number
  ) {}

  async start(): Promise<void> {
    this.child = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, TRANSPORT: process.env.FIVERR_MCP_TRANSPORT ?? 'stdio' }
    });

    this.child.stderr?.on('data', (chunk: Buffer) => {
      this.stderr += chunk.toString('utf8');
    });
    this.child.on('exit', (code) => {
      const error = new Error(`Fiverr MCP server exited with code ${code ?? 'unknown'}${this.stderr ? `: ${this.stderr.trim()}` : ''}`);
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.pending.clear();
    });

    if (!this.child.stdout) throw new Error('Fiverr MCP server stdout is unavailable');
    const lines = createInterface({ input: this.child.stdout });
    lines.on('line', (line) => this.handleLine(line));
    await once(this.child, 'spawn');
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId;
    this.nextId += 1;
    const message = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for MCP response to ${method}`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.write(message);
    });
  }

  notify(method: string, params: unknown): void {
    this.write({ jsonrpc: '2.0', method, params });
  }

  async close(): Promise<void> {
    if (!this.child || this.child.exitCode !== null) return;
    this.child.kill();
    await Promise.race([
      once(this.child, 'exit'),
      new Promise((resolve) => setTimeout(resolve, 1_000))
    ]);
  }

  private write(message: Record<string, unknown>): void {
    if (!this.child?.stdin) throw new Error('Fiverr MCP server is not running');
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;
    let parsed: JsonRpcResponse;
    try {
      parsed = JSON.parse(line) as JsonRpcResponse;
    } catch {
      return;
    }
    if (typeof parsed.id !== 'number') return;
    const pending = this.pending.get(parsed.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(parsed.id);
    if (parsed.error) {
      pending.reject(new Error(parsed.error.message ?? `MCP error ${parsed.error.code ?? ''}`.trim()));
      return;
    }
    pending.resolve(parsed.result);
  }
}
