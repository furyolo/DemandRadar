import type { LlmMessage } from '../integrations/llmClient.js';

export const READER_TRANSLATION_PROMPT_VERSION = 'm37_v2';

export const READER_TRANSLATION_SYSTEM_PROMPT = `您是一位专业的翻译助手，任务是将 English 文本准确、自然、且富有感染力地翻译成简体中文，仅供个人审阅使用。

请将用户提供的 English 文本翻译成 Simplified Chinese。输出必须仅包含译文本身，请勿包含任何前言、解释、总结、评价、metadata、改写建议或其他非译文内容。

翻译要求：
- 语言风格：使用地道的中文母语者日常口语风格，译文自然流畅，避免书面语和机器翻译痕迹。
- 语气情感：略微非正式，尽量传达原文中的热情、真诚、赞赏、紧张感、好奇心和节奏感。
- 表达技巧：在不改变原意的前提下，巧妙融入地道的中文俗语和口语化表达，例如“压榨”“忍痛割爱”这类有画面感但不浮夸的说法，让译文生动活泼、贴近真实对话。
- 翻译策略：避免生硬字面直译；先理解原文核心意思、情绪和观看节奏，再用自然流畅的中文重新组织表达，做到神形兼备。
- 结构保留：保留原文 Markdown 结构、标题层级、链接、引用、列表顺序、信息顺序、强调方式和 pacing。
- 专有名词处理：英文原文中的产品名称、软件名称、技术术语、模型名称、品牌名称、代码标识符、特定英文缩写等专有名词必须保留原始英文形式，不进行翻译，例如 Cursor、Gemini-2.5-pro-exp、VS Code、API、GPT-4。请将这些英文术语自然嵌入中文译文中。重要示例：如果原文是 "Add Gemini-2.5-pro-exp to Cursor"，好的翻译应类似“快把 Gemini-2.5-pro-exp 加到 Cursor 里试试！”或“推荐将 Gemini-2.5-pro-exp 集成到 Cursor 中”，绝不能翻译 Cursor 或 Gemini-2.5-pro-exp。
- 译文目标：高度自然、地道的中文口语译文，像真诚用户热情推荐给中文读者的审阅稿，而不是机器翻译。

请务必只返回高质量、地道的中文口语化译文。`;

export interface MarkdownTranslationLlm {
  generateText(messages: LlmMessage[]): Promise<string>;
}

export interface ReaderTranslationZhCnInput {
  text: string;
  llm?: MarkdownTranslationLlm;
  process: string;
  sourceLanguage: string;
  skipIfSimplifiedChinese?: boolean;
}

export interface ReaderTranslationZhCnResult {
  purpose: 'personal_review_only';
  product_output: false;
  model_source: 'LLM_MODEL';
  prompt_version: typeof READER_TRANSLATION_PROMPT_VERSION;
  source_language: string;
  process: string;
  zh_cn_text: string | null;
  skipped?: boolean;
  skip_reason?: 'source_text_already_simplified_chinese';
  translation_error?: string;
}

export interface TranslateMarkdownReportInput {
  markdown: string;
  title: string;
  summary?: string;
  terms?: string[];
  llm: MarkdownTranslationLlm;
}

export async function translateMarkdownReport(input: TranslateMarkdownReportInput): Promise<string> {
  const sidecar = await generateReaderTranslationZhCn({
    text: [
      `Title: ${input.title}`,
      input.summary ? `Summary: ${input.summary}` : null,
      input.terms && input.terms.length > 0 ? `Terms to preserve: ${input.terms.join(', ')}` : null,
      '',
      input.markdown
    ].filter(Boolean).join('\n'),
    llm: input.llm,
    process: 'demandradar_report_translation_zh_cn',
    sourceLanguage: 'en'
  });
  return sidecar.zh_cn_text ?? input.markdown;
}

export async function generateReaderTranslationZhCn(input: ReaderTranslationZhCnInput): Promise<ReaderTranslationZhCnResult> {
  const sidecar = baseSidecar(input);
  const sourceText = cleanLongText(input.text);
  if (!sourceText) return { ...sidecar, translation_error: 'empty_source_text' };
  if (input.skipIfSimplifiedChinese && isSimplifiedChineseText(sourceText)) {
    return {
      ...sidecar,
      skipped: true,
      skip_reason: 'source_text_already_simplified_chinese'
    };
  }
  if (!input.llm) return { ...sidecar, translation_error: 'llm_unavailable' };

  try {
    const translated = await input.llm.generateText([
      { role: 'system', content: READER_TRANSLATION_SYSTEM_PROMPT },
      { role: 'user', content: sourceText }
    ]);
    return { ...sidecar, zh_cn_text: cleanLongText(translated) };
  } catch (error) {
    return { ...sidecar, translation_error: cleanLongText(error instanceof Error ? error.message : String(error), 500) };
  }
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

export function isSimplifiedChineseText(value: string): boolean {
  const text = cleanLongText(value);
  if (!text) return false;
  const chineseCount = Array.from(text).filter((char) => char >= '\u4e00' && char <= '\u9fff').length;
  const asciiLetterCount = Array.from(text).filter((char) => /^[A-Za-z]$/.test(char)).length;
  return chineseCount >= 8 && chineseCount >= asciiLetterCount;
}

function baseSidecar(input: ReaderTranslationZhCnInput): ReaderTranslationZhCnResult {
  return {
    purpose: 'personal_review_only',
    product_output: false,
    model_source: 'LLM_MODEL',
    prompt_version: READER_TRANSLATION_PROMPT_VERSION,
    source_language: input.sourceLanguage,
    process: input.process,
    zh_cn_text: null
  };
}

function cleanLongText(value: unknown, maxLength = 20000): string {
  const text = String(value ?? '').trim();
  return text.length > maxLength ? text.slice(0, maxLength).trimEnd() : text;
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
