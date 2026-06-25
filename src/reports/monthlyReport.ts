import type { ReportArtifact, ReportLocale } from '../pipeline/types.js';
import type { RenderedMarkdown } from './miniBrief.js';

export interface MonthlyReportInput {
  month: string;
  weeklyReports: ReportArtifact[];
  locale?: ReportLocale;
}

export function generateMonthlyReport(input: MonthlyReportInput): RenderedMarkdown {
  const locale = input.locale ?? 'en';
  const weeklyInputs = input.weeklyReports.map((report) => `- ${report.title} (${report.path})`).join('\n');
  const recurringThemes = input.weeklyReports.length > 0
    ? input.weeklyReports.map((report, index) => `${index + 1}. Review recurring opportunities from ${report.title}`).join('\n')
    : '- No weekly reports available';
  const markdown = locale === 'zh-CN'
    ? `# DemandRadar 月报 - ${input.month}

## 反复出现的主题

${recurringThemes}

## 值得投入的方向

${input.weeklyReports.length > 0 ? '- 优先处理在多周报告中重复出现的主题，并保留来源回链。' : '- 目前还没有值得投入的方向。'}

## 周报回链

${weeklyInputs || '- 暂无周报产物'}
`
    : `# DemandRadar Monthly - ${input.month}

## Recurring Themes

${recurringThemes}

## Investment-Worthy Directions

${input.weeklyReports.length > 0 ? '- Prioritize themes that appear across multiple weekly reports and preserve source back-links.' : '- No investment-worthy directions available yet.'}

## Source Back-links

${weeklyInputs || '- No weekly report artifacts found'}
`;
  return {
    path: locale === 'zh-CN' ? `reports/monthly/${input.month}.zh-CN.md` : `reports/monthly/${input.month}.en.md`,
    markdown,
    title: locale === 'zh-CN' ? `DemandRadar 月报 - ${input.month}` : `DemandRadar Monthly - ${input.month}`
  };
}
