import { spawn } from 'node:child_process';

export interface SmartSearchClientOptions {
  bin?: string;
  timeoutMs?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface SmartSearchCommandResult {
  command: string[];
  query?: string;
  url?: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  parsed: unknown;
  started_at: string;
  completed_at: string;
}

export interface SmartSearchQueryOptions {
  limit?: number;
  timeWindowDays?: number;
}

export class SmartSearchClient {
  private readonly bin: string;
  private readonly timeoutMs: number;
  private readonly cwd?: string;
  private readonly env?: NodeJS.ProcessEnv;

  constructor(options: SmartSearchClientOptions = {}) {
    this.bin = options.bin ?? process.env.SMART_SEARCH_BIN ?? 'smart-search';
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.cwd = options.cwd;
    this.env = options.env;
  }

  search(query: string, options: SmartSearchQueryOptions = {}): Promise<SmartSearchCommandResult> {
    return this.run(['search', query, '--format', 'json'], { query });
  }

  exaSearch(query: string, options: SmartSearchQueryOptions = {}): Promise<SmartSearchCommandResult> {
    return this.run(['exa-search', query, '--format', 'json', '--num-results', String(options.limit ?? 10), '--include-highlights'], { query });
  }

  fetch(url: string): Promise<SmartSearchCommandResult> {
    return this.run(['fetch', url], { url });
  }

  private run(args: string[], metadata: { query?: string; url?: string }): Promise<SmartSearchCommandResult> {
    const started_at = new Date().toISOString();
    return new Promise((resolve, reject) => {
      const child = spawn(this.bin, args, {
        cwd: this.cwd,
        env: { ...process.env, ...this.env },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Smart Search command timed out after ${this.timeoutMs}ms: ${this.bin} ${args.join(' ')}`));
      }, this.timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (exitCode) => {
        clearTimeout(timer);
        const completed_at = new Date().toISOString();
        const parsed = parseMaybeJson(stdout);
        if (exitCode !== 0) {
          const detail = stderr.trim() || stdout.trim() || `exit code ${exitCode ?? -1}`;
          reject(new Error(`Smart Search command failed: ${this.bin} ${args.join(' ')}\n${detail}`));
          return;
        }
        resolve({
          command: [this.bin, ...args],
          ...metadata,
          stdout,
          stderr,
          exitCode: exitCode ?? -1,
          parsed,
          started_at,
          completed_at
        });
      });
    });
  }
}

function parseMaybeJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}
