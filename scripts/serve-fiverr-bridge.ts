import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { openDatabase } from '../src/storage/database.js';
import { DemandRadarRepository, type FiverrDraftStatus, type FiverrUploadEventType } from '../src/storage/repositories.js';

interface Args {
  dbPath: string;
  host: string;
  port: number;
  token: string;
}

interface StatusPayload {
  status?: FiverrDraftStatus;
  eventType?: FiverrUploadEventType;
  note?: string | null;
  fiverrGigUrl?: string | null;
}

const args = parseArgs(process.argv.slice(2));
const db = openDatabase(args.dbPath);
const repository = new DemandRadarRepository(db);

const server = createServer(async (request, response) => {
  try {
    await handleRequest(request, response);
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(args.port, args.host, () => {
  console.error(`[DemandRadar] Fiverr bridge listening at http://${args.host}:${args.port}`);
  console.error(`[DemandRadar] Database: ${args.dbPath}`);
  console.error('[DemandRadar] Publish remains manual. The bridge only reads drafts and records statuses.');
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  setCorsHeaders(response);
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url ?? '/', `http://${args.host}:${args.port}`);
  if (requestUrl.pathname === '/health' && request.method === 'GET') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (!isAuthorized(request)) {
    sendJson(response, 401, { ok: false, error: 'Missing or invalid x-demandradar-token header.' });
    return;
  }

  if (requestUrl.pathname === '/api/drafts/next' && request.method === 'GET') {
    const draft = repository.listFiverrGigDrafts(['asset_ready', 'draft_generated', 'draft_saved'], 1)[0] ?? null;
    sendJson(response, 200, { ok: true, draft });
    return;
  }

  if (requestUrl.pathname === '/api/drafts' && request.method === 'GET') {
    const limit = parseLimit(requestUrl.searchParams.get('limit'), 20);
    const drafts = repository.listFiverrGigDrafts(['asset_ready', 'draft_generated', 'filling', 'draft_saved'], limit);
    sendJson(response, 200, { ok: true, drafts });
    return;
  }

  const statusMatch = requestUrl.pathname.match(/^\/api\/drafts\/([^/]+)\/status$/);
  if (statusMatch && request.method === 'POST') {
    const draftId = decodeURIComponent(statusMatch[1] ?? '');
    const payload = await readJsonBody<StatusPayload>(request);
    const status = normalizeStatus(payload.status);
    repository.recordFiverrUploadEvent({
      draftId,
      eventType: payload.eventType ?? eventForStatus(status),
      status,
      fiverrGigUrl: payload.fiverrGigUrl ?? null,
      note: payload.note ?? null,
      now: new Date().toISOString()
    });
    sendJson(response, 200, { ok: true, draft: repository.getFiverrGigDraft(draftId) });
    return;
  }

  sendJson(response, 404, { ok: false, error: 'Not found.' });
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-demandradar-token');
  response.setHeader('Access-Control-Max-Age', '86400');
}

function isAuthorized(request: IncomingMessage): boolean {
  return request.headers['x-demandradar-token'] === args.token;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return (text ? JSON.parse(text) : {}) as T;
}

function normalizeStatus(status: FiverrDraftStatus | undefined): FiverrDraftStatus {
  const allowed: FiverrDraftStatus[] = ['draft_generated', 'asset_ready', 'filling', 'draft_saved', 'published', 'skipped', 'failed'];
  if (status && allowed.includes(status)) return status;
  return 'filling';
}

function eventForStatus(status: FiverrDraftStatus): FiverrUploadEventType {
  if (status === 'draft_saved') return 'draft_saved';
  if (status === 'published') return 'published';
  if (status === 'skipped') return 'skipped';
  if (status === 'failed') return 'failed';
  return 'fill_started';
}

function parseLimit(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 100 ? parsed : fallback;
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

  return {
    dbPath: values.get('db') ?? process.env.DEMANDRADAR_DB_PATH ?? 'data/demandradar.sqlite',
    host: values.get('host') ?? '127.0.0.1',
    port: parsePort(values.get('port'), 3233),
    token: values.get('token') ?? process.env.FIVERR_BRIDGE_TOKEN ?? 'demandradar-local'
  };
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

function shutdown(): void {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
