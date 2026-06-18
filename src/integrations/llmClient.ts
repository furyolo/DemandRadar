import OpenAI from 'openai';
import { z } from 'zod';

export interface LlmClientOptions {
  baseURL?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LlmClientError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LlmClientError';
  }
}

export class LlmClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: LlmClientOptions = {}) {
    const baseURL = options.baseURL ?? process.env.LLM_BASE_URL;
    const apiKey = options.apiKey ?? process.env.LLM_API_KEY;
    const model = options.model ?? process.env.LLM_MODEL;
    if (!apiKey) throw new LlmClientError('Missing LLM_API_KEY for OpenAI-compatible provider');
    if (!model) throw new LlmClientError('Missing LLM_MODEL for OpenAI-compatible provider');
    this.model = model;
    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: options.timeoutMs,
      maxRetries: options.maxRetries ?? 1
    });
  }

  async generateJson<T>(schema: z.ZodType<T>, messages: LlmMessage[]): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      response_format: { type: 'json_object' }
    });
    const content = response.choices[0]?.message.content;
    if (!content) throw new LlmClientError('LLM response did not include message content');
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new LlmClientError('LLM response was not valid JSON', { cause: error });
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new LlmClientError(`LLM response failed schema validation: ${result.error.message}`, { cause: result.error });
    }
    return result.data;
  }
}
