import type { LlmMessage } from '../integrations/llmClient.js';

export interface MarkdownTranslationLlm {
  generateText(messages: LlmMessage[]): Promise<string>;
}

export interface TranslateMarkdownReportInput {
  markdown: string;
  title: string;
  summary?: string;
  terms?: string[];
  llm: MarkdownTranslationLlm;
}

export async function translateMarkdownReport(input: TranslateMarkdownReportInput): Promise<string> {
  return input.llm.generateText([
    {
      role: 'system',
      content: [
        'You are a professional translation assistant for DemandRadar analytical reports.',
        'Translate finalized English Markdown into natural Simplified Chinese.',
        'Return only the translated Markdown, with no preface or explanation.',
        'Preserve URLs, Markdown headings, tables, lists, code fences, product names, software names, technical terms, model names, brand names, API names, code identifiers, and English abbreviations.',
        'Keep source quotes in their original English when they are quoted evidence from a source.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        'Translate the following English report to Simplified Chinese.',
        `Title: ${input.title}`,
        input.summary ? `Summary: ${input.summary}` : null,
        input.terms && input.terms.length > 0 ? `Terms to preserve: ${input.terms.join(', ')}` : null,
        '',
        input.markdown
      ].filter(Boolean).join('\n')
    }
  ]);
}

export function needsSimplifiedChineseTranslation(markdown: string): boolean {
  const prose = markdown
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/[A-Za-z0-9_-]+\.(md|ts|js|json|sqlite)/g, ' ');
  const englishWordMatches = prose.match(/\b[A-Za-z]{4,}\b/g) ?? [];
  const chineseMatches = prose.match(/[\u4e00-\u9fff]/g) ?? [];
  if (englishWordMatches.length === 0) return false;
  if (chineseMatches.length === 0) return true;

  const englishWords = englishWordMatches.filter((word) => !PRESERVED_ENGLISH_TERMS.has(word.toLowerCase()));
  return englishWords.length >= 8;
}

const PRESERVED_ENGLISH_TERMS = new Set([
  'api',
  'demandradar',
  'markdown',
  'rednote',
  'goofish',
  'sqlite',
  'briefs',
  'reports',
  'source',
  'urls',
  'daily'
]);
