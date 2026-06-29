import type { GoofishCliImportResult, GoofishImportItem } from '../integrations/goofishCliAdapter.js';

export interface FiverrGigDraftOptions {
  query: string;
  maxItems?: number;
  marginPercent?: number;
  minSourceMultiple?: number;
  cnyPerUsd?: number;
  payoutFeePercent?: number;
  fxLossPercent?: number;
  generatedAt?: string;
}

export interface FiverrGigDraftPayload {
  item: GoofishImportItem;
  source_key: string;
  source_url: string;
  service_label: string;
  form_fill_map: ReturnType<typeof buildFormFillMap>;
  image_prompt: string;
  markdown: string;
}

interface DraftItem {
  item: GoofishImportItem;
  sourceCostCny: number | null;
  packagePrices: {
    basic: number;
    standard: number;
    premium: number;
  };
  deliveryDays: {
    basic: number;
    standard: number;
    premium: number;
  };
  tags: string[];
  serviceLabel: string;
}

const DEFAULT_MARGIN_PERCENT = 40;
const DEFAULT_MIN_SOURCE_MULTIPLE = 10;
const DEFAULT_CNY_PER_USD = 7.2;
const DEFAULT_PAYOUT_FEE_PERCENT = 20;
const DEFAULT_FX_LOSS_PERCENT = 10;

export function renderFiverrGigDrafts(input: GoofishCliImportResult | { items: GoofishImportItem[] }, options: FiverrGigDraftOptions): string {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const normalized = normalizeDraftOptions(options, input.items.length);
  const payloads = buildFiverrGigDraftPayloads(input, options);

  const sections = payloads.length > 0
    ? payloads.map((payload) => payload.markdown).join('\n\n---\n\n')
    : '_没有找到可转成 Fiverr Gig 的闲鱼供给记录。请换一个供给型关键词，例如“网站搭建 接单”“logo 设计 接单”。_';

  return [
    '# Goofish to Fiverr Gig Drafts',
    '',
    `- 生成时间：${generatedAt}`,
    `- 闲鱼检索词：${options.query}`,
    `- 定价假设：按“闲鱼成本 * (1 + ${normalized.marginPercent}%)”与“净收入至少覆盖闲鱼成本 ${normalized.minSourceMultiple}x”两者较高值定价，按 ${normalized.cnyPerUsd} CNY/USD 估算，再倒推 ${normalized.payoutFeePercent}% 提现/平台手续费与 ${normalized.fxLossPercent}% 汇率折损，并向上取整到 Fiverr 常见价格档。`,
    '- 发布边界：以下“公开字段”可复制到 Fiverr；“私有供给来源索引”只供履约回查，不建议放进 Fiverr 公开页面。',
    '',
    sections
  ].join('\n');
}

export function buildFiverrGigDraftPayloads(input: GoofishCliImportResult | { items: GoofishImportItem[] }, options: FiverrGigDraftOptions): FiverrGigDraftPayload[] {
  const normalized = normalizeDraftOptions(options, input.items.length);
  return input.items
    .filter(isLikelySupply)
    .slice(0, normalized.maxItems)
    .map((item, index) => {
      const draft = buildDraftItem(item, { ...normalized, query: options.query });
      return {
        item,
        source_key: goofishSourceKey(item),
        source_url: goofishSourceUrl(item),
        service_label: draft.serviceLabel,
        form_fill_map: buildFormFillMap(draft),
        image_prompt: buildImagePrompt(draft),
        markdown: renderDraftSection(draft, index + 1)
      };
    });
}

function normalizeDraftOptions(options: FiverrGigDraftOptions, fallbackLimit: number) {
  return {
    maxItems: normalizePositiveInteger(options.maxItems, fallbackLimit),
    marginPercent: normalizePositiveNumber(options.marginPercent, DEFAULT_MARGIN_PERCENT),
    minSourceMultiple: normalizePositiveNumber(options.minSourceMultiple, DEFAULT_MIN_SOURCE_MULTIPLE),
    cnyPerUsd: normalizePositiveNumber(options.cnyPerUsd, DEFAULT_CNY_PER_USD),
    payoutFeePercent: normalizePercent(options.payoutFeePercent, DEFAULT_PAYOUT_FEE_PERCENT),
    fxLossPercent: normalizePercent(options.fxLossPercent, DEFAULT_FX_LOSS_PERCENT)
  };
}

function buildDraftItem(
  item: GoofishImportItem,
  options: { marginPercent: number; minSourceMultiple: number; cnyPerUsd: number; payoutFeePercent: number; fxLossPercent: number; query: string }
): DraftItem {
  const sourceCostCny = parseCnyPrice(item.price);
  const netRate = (1 - options.payoutFeePercent / 100) * (1 - options.fxLossPercent / 100);
  const baseUsd = sourceCostCny === null
    ? 25
    : Math.max(
      5,
      (sourceCostCny * (1 + options.marginPercent / 100)) / options.cnyPerUsd / netRate,
      (sourceCostCny * options.minSourceMultiple) / options.cnyPerUsd / netRate
    );
  const basic = roundUpFiverrPrice(baseUsd);
  const serviceLabel = inferServiceLabel(item, options.query);

  return {
    item,
    sourceCostCny,
    serviceLabel,
    packagePrices: {
      basic,
      standard: roundUpFiverrPrice(basic * 1.8),
      premium: roundUpFiverrPrice(basic * 3)
    },
    deliveryDays: {
      basic: 7,
      standard: 10,
      premium: 14
    },
    tags: inferTags(item, options.query)
  };
}

function renderDraftSection(draft: DraftItem, index: number): string {
  const { item } = draft;
  const sourceUrl = item.url ?? (item.item_id ? `https://www.goofish.com/item?id=${encodeURIComponent(item.item_id)}` : 'MISSING_SOURCE_URL');
  const description = item.description ?? 'Seller did not provide a detailed description. Confirm scope before accepting orders.';

  return [
    `## Draft ${index}: ${draft.serviceLabel}`,
    '',
    '### Fiverr Form Fill Map（浏览器辅助填表用）',
    '',
    '```json',
    JSON.stringify(buildFormFillMap(draft), null, 2),
    '```',
    '',
    '### Fiverr 公开字段',
    '',
    `**Gig Title（填在 Fiverr 的 “I will ...” 后面）**  `,
    `coordinate ${draft.serviceLabel.toLowerCase()} with reliable delivery`,
    '',
    '**Category 建议**  ',
    categorySuggestion(draft),
    '',
    '**Search Tags（最多 5 个）**  ',
    draft.tags.map((tag) => `\`${tag}\``).join(', '),
    '',
    '**Packages**',
    '',
    '| Package | Scope | Delivery | Revisions | Price |',
    '| --- | --- | ---: | ---: | ---: |',
    `| Basic | Source coordination, requirement check, and one deliverable handoff | ${draft.deliveryDays.basic} days | 1 | $${draft.packagePrices.basic} |`,
    `| Standard | Basic + supplier clarification and quality review checklist | ${draft.deliveryDays.standard} days | 2 | $${draft.packagePrices.standard} |`,
    `| Premium | Standard + priority coordination and final acceptance summary | ${draft.deliveryDays.premium} days | 3 | $${draft.packagePrices.premium} |`,
    '',
    '**Description（不超过 Fiverr 1,200 字符）**',
    '',
    '```text',
    `I will coordinate ${draft.serviceLabel.toLowerCase()} for your project, handle requirement clarification, manage supplier communication, and deliver the final output with a clear acceptance checklist.`,
    '',
    'This gig is best for buyers who know the outcome they need but want someone to manage sourcing, coordination, and delivery follow-up.',
    '',
    'What is included:',
    '- Requirement review before work starts',
    '- Supplier coordination and progress tracking',
    '- Final delivery handoff with a simple quality checklist',
    '- Revision coordination within the selected package',
    '',
    'Please send your goal, examples, deadline, and any technical or brand requirements before ordering.',
    '```',
    '',
    '**Buyer Requirements**',
    '',
    '- What outcome do you need?',
    '- Please share examples, references, or files.',
    '- What is your deadline?',
    '- Are there any language, style, platform, size, format, or compliance requirements?',
    '- What would make the delivery unacceptable?',
    '',
    '**Gallery / Media Assets（发布前准备）**',
    '',
    '- Required image: prepare at least 1 original landscape Gig image; recommended 1280 x 769 px, minimum 712 x 430 px.',
    '- Optional images: add up to 3 images total. Use owned work samples, process screenshots, or a clean service explainer graphic.',
    '- Optional video: prepare 1 landscape MP4 or AVI under 50 MB. Aim for 20-60 seconds and do not exceed 75 seconds; do not include contact info, external URLs, or unlicensed audio/visuals.',
    '- Optional PDFs: add up to 2 PDFs for portfolio samples, case studies, process docs, or written deliverable previews.',
    '- Do not use Goofish listing screenshots, seller images, platform logos, or third-party portfolio assets unless you have explicit permission.',
    '',
    '**Required Gig Image Brief（至少生成 / 准备 1 张）**',
    '',
    '- Asset: Fiverr Gig cover image',
    '- Size: 1280 x 769 px, landscape',
    '- Visual: original service explainer graphic or realistic workspace scene for the service',
    '- Text overlay: use at most 10 words, no contact info, no URLs, no platform logos',
    '- Avoid: Goofish screenshots, Fiverr badges, review stars, seller metrics, unlicensed portfolio work, copyrighted logos',
    '',
    '**Image Generation Prompt**',
    '',
    '```text',
    buildImagePrompt(draft),
    '```',
    '',
    '**FAQ**',
    '',
    '- Q: Do you create everything yourself?  ',
    '  A: I manage sourcing, coordination, and delivery review. Specialist fulfillment may be handled by matched suppliers.',
    '- Q: Can you start immediately?  ',
    '  A: I can start requirement review after receiving complete order details. Supplier availability must be confirmed per order.',
    '',
    '### 私有供给来源索引',
    '',
    `- 闲鱼标题：${item.title}`,
    `- 闲鱼链接：${sourceUrl}`,
    `- 卖家：${item.seller ?? '未知'}`,
    `- 卖家链接：${item.seller_url ?? '未知'}`,
    `- 标价：${item.price ?? '未知'}${draft.sourceCostCny === null ? '' : `（解析为约 ${draft.sourceCostCny} CNY）`}`,
    `- 地区：${item.location ?? item.city ?? '未知'}`,
    `- 供给描述：${description}`,
    '',
    '### 履约前检查',
    '',
    '- Fiverr 下单后，先回到闲鱼链接确认供给仍存在、价格未变、卖家可接单。',
    '- 不要承诺闲鱼卖家没有确认过的交付时间、版权、售后或商用授权。',
    '- 若交付物涉及版权、素材、账号、软件授权或平台代操作，先确认 Fiverr 和闲鱼双方规则。'
  ].join('\n');
}

function buildFormFillMap(draft: DraftItem) {
  return {
    title_suffix_after_i_will: `coordinate ${draft.serviceLabel.toLowerCase()} with reliable delivery`,
    category_suggestion: categorySuggestion(draft),
    search_tags: draft.tags,
    packages: {
      basic: {
        name: 'Basic',
        description: 'Source coordination, requirement check, and one deliverable handoff',
        delivery_days: draft.deliveryDays.basic,
        revisions: 1,
        price_usd: draft.packagePrices.basic
      },
      standard: {
        name: 'Standard',
        description: 'Basic + supplier clarification and quality review checklist',
        delivery_days: draft.deliveryDays.standard,
        revisions: 2,
        price_usd: draft.packagePrices.standard
      },
      premium: {
        name: 'Premium',
        description: 'Standard + priority coordination and final acceptance summary',
        delivery_days: draft.deliveryDays.premium,
        revisions: 3,
        price_usd: draft.packagePrices.premium
      }
    },
    description: [
      `I will coordinate ${draft.serviceLabel.toLowerCase()} for your project, handle requirement clarification, manage supplier communication, and deliver the final output with a clear acceptance checklist.`,
      '',
      'This gig is best for buyers who know the outcome they need but want someone to manage sourcing, coordination, and delivery follow-up.',
      '',
      'What is included:',
      '- Requirement review before work starts',
      '- Supplier coordination and progress tracking',
      '- Final delivery handoff with a simple quality checklist',
      '- Revision coordination within the selected package',
      '',
      'Please send your goal, examples, deadline, and any technical or brand requirements before ordering.'
    ].join('\n'),
    buyer_requirements: [
      { question: 'What outcome do you need?', required: true },
      { question: 'Please share examples, references, or files.', required: true },
      { question: 'What is your deadline?', required: true },
      { question: 'Are there any language, style, platform, size, format, or compliance requirements?', required: true },
      { question: 'What would make the delivery unacceptable?', required: false }
    ],
    gallery_assets: {
      required_images_min: 1,
      images_max: 3,
      recommended_image_size: '1280 x 769 px',
      optional_video: 'MP4 or AVI under 50 MB; aim for 20-60 seconds and do not exceed 75 seconds',
      optional_pdfs_max: 2
    },
    manual_publish_gate: 'Create or save the Gig as a draft first. The final Publish click must be confirmed by the user.'
  };
}

function goofishSourceKey(item: GoofishImportItem): string {
  if (item.item_id) return `goofish:item:${item.item_id}`;
  return `goofish:url:${goofishSourceUrl(item).toLowerCase()}`;
}

function goofishSourceUrl(item: GoofishImportItem): string {
  return item.url ?? (item.item_id ? `https://www.goofish.com/item?id=${encodeURIComponent(item.item_id)}` : `https://www.goofish.com/search?q=${encodeURIComponent(item.title)}`);
}

function buildImagePrompt(draft: DraftItem): string {
  const shortLabel = titleCase(draft.serviceLabel.replace(/\s+coordination$/i, ''));
  return [
    'Use case: ads-marketing',
    'Asset type: Fiverr Gig cover image',
    `Primary request: create an original professional cover image for a Fiverr service offering "${draft.serviceLabel}".`,
    'Size/aspect: 1280 x 769 px landscape.',
    'Style/medium: clean modern commercial graphic, high-trust freelance marketplace look, polished but not flashy.',
    `Subject: ${shortLabel} managed delivery, requirement checklist, supplier coordination, and final handoff represented with generic original visuals.`,
    'Composition/framing: clear central service visual with readable negative space for a short headline.',
    `Text (verbatim): "${shortLabel}"`,
    'Constraints: text overlay must be 10 words or fewer; use only original generic visuals; no contact info; no URLs; no watermarks.',
    'Avoid: Goofish screenshots, Fiverr badges, review stars, seller metrics, third-party logos, copyrighted portfolio samples, cluttered text.'
  ].join('\n');
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function isLikelySupply(item: GoofishImportItem): boolean {
  const text = [item.title, item.description, ...(item.tags ?? [])].join(' ');
  if (/求购|求租|找人|找个|需要|有没有|收一个/.test(text)) return false;
  if (/出售|转让|出一个|接单|代做|代写|服务|设计|开发|搭建|剪辑|翻译|维修|定制/.test(text)) return true;
  return item.price !== undefined && item.price !== null;
}

function inferServiceLabel(item: GoofishImportItem, query: string): string {
  const text = `${item.title} ${item.description ?? ''} ${query}`.toLowerCase();
  if (/power\s*bi|powerbi|tableau|数据清洗|数据可视化|可视化|看板|报表|dax|powerquery/.test(text)) return 'data dashboard and analytics delivery';
  if (/logo|标志|品牌|视觉识别|\bvi\b/.test(text)) return 'Logo and brand asset delivery';
  if (/网站|网页|wordpress|shopify|web|landing/.test(text)) return 'website setup or redesign coordination';
  if (/chatbot|自动化|automation|bot|n8n|coze|dify|智能体|工作流|ai\s*(agent|automation|workflow|应用|智能体|工作流|自动化)/.test(text)) return 'AI automation delivery';
  if (/翻译|translate|translation/.test(text)) return 'translation and localization delivery';
  if (/剪辑|视频|video|shorts|reels/.test(text)) return 'video editing delivery';
  if (/ppt|presentation|简历|resume|文案|写作|copy/.test(text)) return 'document and content production';
  return 'custom digital service delivery';
}

function inferTags(item: GoofishImportItem, query: string): string[] {
  const text = `${item.title} ${item.description ?? ''} ${query}`.toLowerCase();
  const tags: string[] = [];
  const add = (tag: string) => {
    if (tags.length < 5 && !tags.includes(tag)) tags.push(tag);
  };

  if (/logo|标志|品牌|视觉识别|\bvi\b/.test(text)) {
    add('logo design'); add('brand design');
  }
  if (/power\s*bi|powerbi|tableau|数据清洗|数据可视化|可视化|看板|报表|dax|powerquery/.test(text)) {
    add('data visualization'); add('dashboard');
  }
  if (/网站|网页|wordpress|shopify|web|landing/.test(text)) {
    add('website'); add('web design');
  }
  if (/翻译|translate|translation/.test(text)) add('translation');
  if (/剪辑|视频|video|shorts|reels/.test(text)) add('video editing');
  if (/ppt|presentation/.test(text)) add('presentation');
  if (/文案|写作|copy/.test(text)) add('copywriting');
  if (/chatbot|自动化|automation|bot|n8n|coze|dify|智能体|工作流|ai\s*(agent|automation|workflow|应用|智能体|工作流|自动化)/.test(text)) add('automation');
  add('project management');
  add('sourcing');

  return tags.slice(0, 5);
}

function categorySuggestion(draft: DraftItem): string {
  const label = draft.serviceLabel.toLowerCase();
  if (label.includes('website')) return 'Programming & Tech / Website Development';
  if (label.includes('logo') || label.includes('brand')) return 'Graphics & Design / Logo Design';
  if (label.includes('data dashboard') || label.includes('analytics')) return 'Data / Data Visualization';
  if (label.includes('translation')) return 'Writing & Translation / Translation';
  if (label.includes('video')) return 'Video & Animation / Video Editing';
  if (label.includes('document') || label.includes('content')) return 'Writing & Translation / Business Writing';
  if (label.includes('automation') || label.includes('ai')) return 'Programming & Tech / AI Development';
  return 'Business / Project Management';
}

function parseCnyPrice(value: GoofishImportItem['price']): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function roundUpFiverrPrice(value: number): number {
  if (value <= 10) return Math.ceil(value);
  if (value <= 100) return Math.ceil(value / 5) * 5;
  return Math.ceil(value / 10) * 10;
}

function normalizePositiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizePercent(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 100 ? value : fallback;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}
