import type { ReportArtifact } from '../pipeline/types.js';
import type { RenderedMarkdown } from './miniBrief.js';

export interface MonthlyReportInput {
  month: string;
  weeklyReports: ReportArtifact[];
}

export function generateMonthlyReport(input: MonthlyReportInput): RenderedMarkdown {
  const weeklyInputs = input.weeklyReports.map((report) => `- ${report.title} (${report.path})`).join('\n');
  const recurringThemes = input.weeklyReports.length > 0
    ? input.weeklyReports.map((report, index) => `${index + 1}. Review recurring opportunities from ${report.title}`).join('\n')
    : '- No weekly reports available';
  const markdown = `# DemandRadar Monthly - ${input.month}

## Recurring Themes

${recurringThemes}

## Investment-Worthy Directions

${input.weeklyReports.length > 0 ? '- Prioritize themes that appear across multiple weekly reports and preserve source back-links.' : '- No investment-worthy directions available yet.'}

## Source Back-links

${weeklyInputs || '- No weekly report artifacts found'}
`;
  return {
    path: `reports/monthly/${input.month}.en.md`,
    markdown,
    title: `DemandRadar Monthly - ${input.month}`
  };
}
