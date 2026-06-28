import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { loadDemandRadarEnv } from '../src/config/env.js';

interface Args {
  code?: string;
  output: string;
  redirectUri?: string;
  state: string;
  scope?: string;
  tokenEndpoint: string;
  timeoutMs: number;
}

const AUTHORIZE_ENDPOINT = 'https://www.upwork.com/ab/account-security/oauth2/authorize';
const DEFAULT_TOKEN_ENDPOINT = 'https://www.upwork.com/api/v3/oauth2/token';
const DEFAULT_TOKEN_FILE = '.tmp/upwork-token.json';

loadDemandRadarEnv();

const args = parseArgs(process.argv.slice(2));
const apiKey = process.env.UPWORK_API_KEY ?? process.env.UPWORK_CLIENT_ID;
const apiSecret = process.env.UPWORK_API_SECRET ?? process.env.UPWORK_CLIENT_SECRET;
const redirectUri = args.redirectUri ?? process.env.UPWORK_REDIRECT_URI;

if (!apiKey) throw new Error('UPWORK_API_KEY is required');
if (!redirectUri) throw new Error('UPWORK_REDIRECT_URI is required');

if (args.code) {
  await exchangeAndSaveToken({
    apiKey,
    apiSecret,
    redirectUri,
    code: args.code,
    output: args.output,
    tokenEndpoint: args.tokenEndpoint
  });
} else if (isLocalRedirectUri(redirectUri)) {
  const authorizationUrl = buildAuthorizationUrl({
    apiKey,
    redirectUri,
    state: args.state,
    scope: args.scope
  });
  console.error(`[DemandRadar] Listening for Upwork OAuth callback on ${redirectUri}`);
  console.error('[DemandRadar] Open this authorization URL in your browser:');
  console.log(authorizationUrl);
  const code = await waitForAuthorizationCode({
    redirectUri,
    expectedState: args.state,
    timeoutMs: args.timeoutMs
  });
  await exchangeAndSaveToken({
    apiKey,
    apiSecret,
    redirectUri,
    code,
    output: args.output,
    tokenEndpoint: args.tokenEndpoint
  });
} else {
  console.error('[DemandRadar] Redirect URI is not local, so automatic callback listening is unavailable.');
  console.error('[DemandRadar] Open this authorization URL, copy the callback code, then run:');
  console.error('npm run upwork:auth -- --code "<code-from-callback>"');
  console.log(buildAuthorizationUrl({
    apiKey,
    redirectUri,
    state: args.state,
    scope: args.scope
  }));
}

export function buildAuthorizationUrl(input: {
  apiKey: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.apiKey,
    response_type: 'code',
    redirect_uri: input.redirectUri,
    state: input.state
  });
  if (input.scope) params.set('scope', input.scope);
  return `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

async function exchangeAndSaveToken(input: {
  apiKey: string;
  apiSecret: string | undefined;
  redirectUri: string;
  code: string;
  output: string;
  tokenEndpoint: string;
}): Promise<void> {
  if (!input.apiSecret) throw new Error('UPWORK_API_SECRET is required to exchange an authorization code');
  const token = await exchangeAuthorizationCode({
    apiKey: input.apiKey,
    apiSecret: input.apiSecret,
    redirectUri: input.redirectUri,
    code: input.code,
    tokenEndpoint: input.tokenEndpoint
  });
  await mkdir(dirname(input.output), { recursive: true });
  await writeFile(input.output, `${JSON.stringify({
    ...token,
    created_at: new Date().toISOString()
  }, null, 2)}\n`, 'utf8');
  console.error(`[DemandRadar] Wrote Upwork OAuth token response to ${input.output}`);
  console.error(`[DemandRadar] Set UPWORK_TOKEN_FILE=${input.output} in config/.env, or copy refresh_token to UPWORK_REFRESH_TOKEN.`);
}

async function exchangeAuthorizationCode(input: {
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  code: string;
  tokenEndpoint: string;
}): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: input.apiKey,
    client_secret: input.apiSecret,
    redirect_uri: input.redirectUri,
    code: input.code
  });
  const response = await fetch(input.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) {
    throw new Error(`Upwork authorization code exchange failed with HTTP ${response.status}`);
  }
  return await response.json() as Record<string, unknown>;
}

function waitForAuthorizationCode(input: {
  redirectUri: string;
  expectedState: string;
  timeoutMs: number;
}): Promise<string> {
  const redirect = new URL(input.redirectUri);
  const port = redirect.port ? Number(redirect.port) : 80;
  const host = redirect.hostname;
  const path = redirect.pathname;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error(`Timed out waiting for Upwork callback after ${input.timeoutMs}ms`));
    }, input.timeoutMs);

    const server = createServer((request, response) => {
      try {
        const callbackUrl = callbackRequestUrl(request, redirect);
        if (callbackUrl.pathname !== path) {
          respond(response, 404, 'Unexpected callback path.');
          return;
        }
        const error = callbackUrl.searchParams.get('error');
        if (error) {
          respond(response, 400, `Upwork authorization failed: ${error}`);
          reject(new Error(`Upwork authorization failed: ${error}`));
          server.close();
          clearTimeout(timeout);
          return;
        }
        const state = callbackUrl.searchParams.get('state');
        if (state !== input.expectedState) {
          respond(response, 400, 'Invalid OAuth state.');
          reject(new Error('Invalid OAuth state'));
          server.close();
          clearTimeout(timeout);
          return;
        }
        const code = callbackUrl.searchParams.get('code');
        if (!code) {
          respond(response, 400, 'Missing authorization code.');
          reject(new Error('Upwork callback did not include code'));
          server.close();
          clearTimeout(timeout);
          return;
        }
        respond(response, 200, 'DemandRadar received the Upwork authorization code. You can close this tab.');
        resolve(code);
        server.close();
        clearTimeout(timeout);
      } catch (error) {
        reject(error);
        server.close();
        clearTimeout(timeout);
      }
    });

    server.once('error', reject);
    server.listen(port, host);
  });
}

function callbackRequestUrl(request: IncomingMessage, redirect: URL): URL {
  return new URL(request.url ?? '/', `${redirect.protocol}//${redirect.host}`);
}

function respond(response: ServerResponse, statusCode: number, message: string): void {
  response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(`${message}\n`);
}

function isLocalRedirectUri(value: string): boolean {
  const url = new URL(value);
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
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
    code: values.get('code'),
    output: values.get('output') ?? process.env.UPWORK_TOKEN_FILE ?? DEFAULT_TOKEN_FILE,
    redirectUri: values.get('redirect-uri'),
    state: values.get('state') ?? 'demandradar-upwork-auth',
    scope: values.get('scope'),
    tokenEndpoint: values.get('token-endpoint') ?? process.env.UPWORK_TOKEN_ENDPOINT ?? DEFAULT_TOKEN_ENDPOINT,
    timeoutMs: parsePositiveInteger(values.get('timeout-ms'), 180_000)
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
