import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildUpworkJobSearchVariables, normalizeUpworkApiJobs, searchUpworkApi } from '../src/integrations/upworkApiAdapter.js';

describe('upworkApiAdapter', () => {
  it('builds read-only marketplace search variables', () => {
    expect(buildUpworkJobSearchVariables({
      query: 'ai automation',
      sortField: 'RECENCY'
    })).toEqual({
      marketPlaceJobFilter: { searchExpression_eq: 'ai automation' },
      searchType: 'USER_JOBS_SEARCH',
      sortAttributes: [{ field: 'RECENCY' }]
    });
  });

  it('normalizes Upwork GraphQL job search nodes', () => {
    const jobs = normalizeUpworkApiJobs([
      {
        id: '~012345',
        ciphertext: '~cipher',
        title: 'Build an AI workflow automation agent',
        description: 'Connect Airtable, Slack, and OpenAI.',
        amount: { rawValue: '800', currency: 'USD', displayValue: '$800' },
        experienceLevel: 'INTERMEDIATE',
        durationLabel: 'Less than 1 month',
        totalApplicants: 4,
        publishedDateTime: '2026-06-18T00:00:00Z',
        skills: [{ name: 'openai-api', prettyName: 'OpenAI API' }],
        client: {
          companyName: 'Acme Ops',
          verificationStatus: 'VERIFIED',
          totalSpent: { rawValue: '12000', currency: 'USD', displayValue: '$12K' },
          totalFeedback: 4.9,
          location: { city: 'Austin', country: 'United States' }
        }
      }
    ]);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      platform: 'upwork',
      job_id: '~012345',
      url: 'https://www.upwork.com/jobs/~cipher',
      title: 'Build an AI workflow automation agent',
      client_name: 'Acme Ops',
      budget: '$800',
      currency: 'USD',
      location: 'Austin, United States',
      payment_verified: true,
      proposal_count: 4,
      client_total_spent: '$12K',
      client_rating: 4.9,
      skills: ['OpenAI API']
    });
  });

  it('searches Upwork GraphQL with bearer auth and returns import JSON', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({
        data: {
          marketplaceJobPostingsSearch: {
            totalCount: 1,
            edges: [
              {
                node: {
                  id: '~012345',
                  title: 'Need a TypeScript automation',
                  description: 'Build a small internal tool.',
                  amount: { rawValue: '500', currency: 'USD', displayValue: '$500' },
                  client: { verificationStatus: 'VERIFIED', location: { country: 'US' } },
                  skills: []
                }
              }
            ],
            pageInfo: { hasNextPage: false }
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const result = await searchUpworkApi({
      query: 'typescript automation',
      limit: 10,
      accessToken: 'token',
      endpoint: 'https://api.upwork.test/graphql',
      fetchImpl
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.upwork.test/graphql');
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: 'Bearer token' });
    expect(result.metadata).toMatchObject({
      provider: 'upwork-api',
      endpoint: 'https://api.upwork.test/graphql',
      query: 'typescript automation',
      total_count: 1,
      search_type: 'USER_JOBS_SEARCH',
      sort_field: 'RECENCY'
    });
    expect(result.jobs[0]).toMatchObject({
      platform: 'upwork',
      title: 'Need a TypeScript automation',
      budget: '$500'
    });
  });

  it('refreshes access token from token file and writes refreshed token back', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'demandradar-upwork-'));
    const tokenFile = join(dir, 'token.json');
    await import('node:fs/promises').then(({ writeFile }) => writeFile(tokenFile, JSON.stringify({ refresh_token: 'refresh-token' }), 'utf8'));
    const calls: string[] = [];
    const fetchImpl = async (url: string | URL | Request): Promise<Response> => {
      calls.push(String(url));
      if (String(url).includes('/oauth2/token')) {
        return new Response(JSON.stringify({
          access_token: 'fresh-access-token',
          refresh_token: 'fresh-refresh-token'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({
        data: {
          marketplaceJobPostingsSearch: {
            totalCount: 0,
            edges: [],
            pageInfo: { hasNextPage: false }
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    await searchUpworkApi({
      query: 'typescript automation',
      limit: 10,
      clientId: 'api-key',
      clientSecret: 'api-secret',
      tokenFile,
      tokenEndpoint: 'https://api.upwork.test/oauth2/token',
      endpoint: 'https://api.upwork.test/graphql',
      fetchImpl
    });

    expect(calls).toEqual([
      'https://api.upwork.test/oauth2/token',
      'https://api.upwork.test/graphql'
    ]);
    await expect(readFile(tokenFile, 'utf8')).resolves.toContain('fresh-refresh-token');
  });
});
