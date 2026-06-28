import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface UpworkApiSearchOptions {
  query: string;
  limit: number;
  accessToken?: string;
  endpoint?: string;
  tokenEndpoint?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  tokenFile?: string;
  filter?: Record<string, unknown>;
  searchType?: string;
  sortField?: string;
  fetchImpl?: typeof fetch;
}

export interface UpworkImportJob {
  platform: 'upwork';
  job_id?: string;
  url?: string;
  title: string;
  description?: string;
  client_name?: string;
  budget?: string | number | null;
  hourly_rate?: string | number | null;
  currency?: string;
  location?: string | null;
  client_country?: string | null;
  experience_level?: string;
  duration?: string;
  project_type?: string;
  payment_verified?: boolean;
  proposal_count?: number;
  client_total_spent?: string | number;
  client_rating?: string | number;
  skills?: string[];
  raw: Record<string, unknown>;
}

export interface UpworkApiImportResult {
  jobs: UpworkImportJob[];
  metadata: {
    provider: 'upwork-api';
    endpoint: string;
    query: string;
    limit: number;
    generated_at: string;
    total_count?: number;
    search_type: string;
    sort_field: string;
  };
}

interface GraphQlResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message?: string }>;
}

const DEFAULT_ENDPOINT = 'https://api.upwork.com/graphql';
const DEFAULT_TOKEN_ENDPOINT = 'https://www.upwork.com/api/v3/oauth2/token';
const DEFAULT_TOKEN_FILE = '.tmp/upwork-token.json';

const JOB_SEARCH_QUERY = `
query DemandRadarMarketplaceJobPostingsSearch(
  $marketPlaceJobFilter: MarketplaceJobPostingsSearchFilter,
  $searchType: MarketplaceJobPostingSearchType,
  $sortAttributes: [MarketplaceJobPostingSearchSortAttribute]
) {
  marketplaceJobPostingsSearch(
    marketPlaceJobFilter: $marketPlaceJobFilter,
    searchType: $searchType,
    sortAttributes: $sortAttributes
  ) {
    totalCount
    edges {
      cursor
      node {
        id
        title
        description
        ciphertext
        recordNumber
        duration
        durationLabel
        engagement
        amount { rawValue currency displayValue }
        experienceLevel
        category
        subcategory
        totalApplicants
        createdDateTime
        publishedDateTime
        renewedDateTime
        hourlyBudgetType
        hourlyBudgetMin { rawValue currency displayValue }
        hourlyBudgetMax { rawValue currency displayValue }
        weeklyBudget { rawValue currency displayValue }
        skills { name prettyName highlighted }
        client {
          totalHires
          totalPostedJobs
          totalSpent { rawValue currency displayValue }
          verificationStatus
          location { city country timezone }
          totalReviews
          totalFeedback
          companyName
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

export async function searchUpworkApi(options: UpworkApiSearchOptions): Promise<UpworkApiImportResult> {
  const fetcher = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? process.env.UPWORK_GRAPHQL_ENDPOINT ?? DEFAULT_ENDPOINT;
  const accessToken = await resolveAccessToken(options, fetcher);
  const variables = buildUpworkJobSearchVariables(options);
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: JOB_SEARCH_QUERY,
      variables
    })
  });

  if (!response.ok) {
    throw new Error(`Upwork GraphQL request failed with HTTP ${response.status}`);
  }

  const body = await response.json() as GraphQlResponse;
  if (body.errors?.length) {
    throw new Error(`Upwork GraphQL request failed: ${body.errors.map((error) => error.message ?? 'Unknown error').join('; ')}`);
  }

  const connection = extractSearchConnection(body);
  const nodes = extractNodes(connection).slice(0, options.limit);
  return {
    jobs: normalizeUpworkApiJobs(nodes),
    metadata: {
      provider: 'upwork-api',
      endpoint,
      query: options.query,
      limit: options.limit,
      generated_at: new Date().toISOString(),
      total_count: numberValue(recordValue(connection, 'totalCount')),
      search_type: String(variables.searchType),
      sort_field: String((variables.sortAttributes as Array<Record<string, unknown>>)[0]?.field ?? '')
    }
  };
}

export function buildUpworkJobSearchVariables(options: Pick<UpworkApiSearchOptions, 'query' | 'filter' | 'searchType' | 'sortField'>): Record<string, unknown> {
  return {
    marketPlaceJobFilter: options.filter ?? { searchExpression_eq: options.query },
    searchType: options.searchType ?? 'USER_JOBS_SEARCH',
    sortAttributes: [{ field: options.sortField ?? 'RECENCY' }]
  };
}

export function normalizeUpworkApiJobs(nodes: unknown[]): UpworkImportJob[] {
  return nodes.flatMap((node) => {
    if (!isRecord(node)) return [];
    const title = stringValue(node.title);
    if (!title) return [];
    const jobId = stringValue(node.id) ?? stringValue(node.recordNumber);
    const ciphertext = stringValue(node.ciphertext);
    const amount = moneyValue(node.amount);
    const hourlyMin = moneyValue(node.hourlyBudgetMin);
    const hourlyMax = moneyValue(node.hourlyBudgetMax);
    const client = isRecord(node.client) ? node.client : {};
    const location = isRecord(client.location) ? client.location : {};
    const country = stringValue(location.country);
    const city = stringValue(location.city);
    return [{
      platform: 'upwork',
      job_id: jobId,
      url: buildJobUrl(ciphertext ?? jobId),
      title,
      description: stringValue(node.description),
      client_name: stringValue(client.companyName),
      budget: amount?.display ?? amount?.raw,
      hourly_rate: formatHourlyRate(hourlyMin, hourlyMax),
      currency: amount?.currency ?? hourlyMin?.currency ?? hourlyMax?.currency,
      location: [city, country].filter(Boolean).join(', ') || null,
      client_country: country ?? null,
      experience_level: stringValue(node.experienceLevel),
      duration: stringValue(node.durationLabel) ?? stringValue(node.duration) ?? stringValue(node.engagement),
      project_type: amount ? 'fixed' : hourlyMin || hourlyMax ? 'hourly' : undefined,
      payment_verified: stringValue(client.verificationStatus)?.toLowerCase().includes('verified'),
      proposal_count: numberValue(node.totalApplicants),
      client_total_spent: moneyValue(client.totalSpent)?.display ?? moneyValue(client.totalSpent)?.raw,
      client_rating: numberValue(client.totalFeedback),
      skills: extractSkills(node.skills),
      raw: node
    }];
  });
}

async function resolveAccessToken(options: UpworkApiSearchOptions, fetcher: typeof fetch): Promise<string> {
  const directToken = options.accessToken ?? process.env.UPWORK_ACCESS_TOKEN;
  if (directToken) return directToken;

  const clientId = options.clientId ?? process.env.UPWORK_CLIENT_ID ?? process.env.UPWORK_API_KEY;
  const clientSecret = options.clientSecret ?? process.env.UPWORK_CLIENT_SECRET ?? process.env.UPWORK_API_SECRET;
  const tokenFile = options.tokenFile ?? process.env.UPWORK_TOKEN_FILE ?? DEFAULT_TOKEN_FILE;
  const tokenFromFile = await readTokenFile(tokenFile);
  const refreshToken = options.refreshToken ?? process.env.UPWORK_REFRESH_TOKEN ?? stringValue(tokenFromFile?.refresh_token);
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Upwork API requires UPWORK_ACCESS_TOKEN, or UPWORK_API_KEY/UPWORK_API_SECRET plus UPWORK_REFRESH_TOKEN or UPWORK_TOKEN_FILE');
  }

  const tokenEndpoint = options.tokenEndpoint ?? process.env.UPWORK_TOKEN_ENDPOINT ?? DEFAULT_TOKEN_ENDPOINT;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  });
  const response = await fetcher(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) {
    throw new Error(`Upwork token refresh failed with HTTP ${response.status}`);
  }
  const parsed = await response.json() as Record<string, unknown>;
  const accessToken = stringValue(parsed.access_token);
  if (!accessToken) {
    throw new Error('Upwork token refresh response did not include access_token');
  }
  await writeTokenFile(tokenFile, {
    ...(tokenFromFile ?? {}),
    ...parsed,
    refreshed_at: new Date().toISOString()
  });
  return accessToken;
}

async function readTokenFile(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function writeTokenFile(path: string, token: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(token, null, 2)}\n`, 'utf8');
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function extractSearchConnection(body: GraphQlResponse): Record<string, unknown> {
  const data = body.data ?? {};
  const connection = data.marketplaceJobPostingsSearch ?? data.marketplaceJobPostings;
  if (!isRecord(connection)) {
    throw new Error('Upwork GraphQL response did not include marketplace job postings');
  }
  return connection;
}

function extractNodes(connection: Record<string, unknown>): unknown[] {
  const edges = connection.edges;
  if (!Array.isArray(edges)) return [];
  return edges.flatMap((edge) => {
    if (!isRecord(edge)) return [];
    return edge.node === undefined ? [] : [edge.node];
  });
}

function buildJobUrl(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return `https://www.upwork.com/jobs/${encodeURIComponent(id)}`;
}

function extractSkills(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const skills = value.flatMap((skill) => {
    if (!isRecord(skill)) return [];
    const text = stringValue(skill.prettyName) ?? stringValue(skill.name);
    return text ? [text] : [];
  });
  return skills.length > 0 ? skills : undefined;
}

function formatHourlyRate(min: MoneyValue | undefined, max: MoneyValue | undefined): string | undefined {
  if (min?.display && max?.display) return `${min.display}-${max.display}`;
  return min?.display ?? max?.display ?? min?.raw ?? max?.raw;
}

interface MoneyValue {
  raw?: string;
  currency?: string;
  display?: string;
}

function moneyValue(value: unknown): MoneyValue | undefined {
  if (!isRecord(value)) return undefined;
  const raw = stringValue(value.rawValue);
  const currency = stringValue(value.currency);
  const display = stringValue(value.displayValue);
  if (!raw && !display) return undefined;
  return { raw, currency, display };
}

function recordValue(record: Record<string, unknown>, key: string): unknown {
  return record[key];
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
