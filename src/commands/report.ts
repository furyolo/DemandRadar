import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDatabase } from '../storage/database.js';
import { DemandRadarRepository } from '../storage/repositories.js';
import type { ReportCadence, ReportLocale } from '../pipeline/types.js';
import { reportPeriodFor, todayUtcDate } from '../time/reportDate.js';

export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .description('Print a Markdown report path or content.')
    .argument('[date]', 'Report date')
    .option('--reports-dir <path>', 'Reports output directory', process.env.REPORTS_DIR ?? 'reports')
    .option('--db <path>', 'SQLite database path for repository-backed report lookup')
    .option('--cadence <cadence>', 'Report cadence: daily, weekly, monthly', 'daily')
    .option('--locale <locale>', 'Report locale: en, zh-CN', 'en')
    .option('--print', 'Print report contents')
    .action((date: string | undefined, options) => {
      const reportDate = date ?? todayUtcDate();
      const path = options.db
        ? findReportPath({
          dbPath: options.db,
          reportsDir: options.reportsDir,
          date: reportDate,
          cadence: options.cadence,
          locale: options.locale
        })
        : join(options.reportsDir, `${reportDate}.md`);
      if (options.print) {
        console.log(readFileSync(path, 'utf8'));
      } else {
        console.log(options.db ? path.replace(/\\/g, '/') : path);
      }
    });
}

function findReportPath(input: {
  dbPath: string;
  reportsDir: string;
  date: string;
  cadence: ReportCadence;
  locale: ReportLocale;
}): string {
  const db = openDatabase(input.dbPath);
  try {
    const repository = new DemandRadarRepository(db);
    const period = reportPeriodFor(input.date, input.cadence);
    const artifact = repository.findReportArtifact({
      cadence: input.cadence,
      locale: input.locale,
      periodStart: period.start,
      periodEnd: period.end
    });
    if (artifact) return resolveReportPath(input.reportsDir, artifact.path);
    if (input.locale === 'zh-CN') {
      const english = repository.findReportArtifact({
        cadence: input.cadence,
        locale: 'en',
        periodStart: period.start,
        periodEnd: period.end
      });
      if (english) {
        throw new Error(`localized variant missing: ${resolveReportPath(input.reportsDir, english.path)}`);
      }
    }
    throw new Error(`Report artifact not found for ${input.cadence} ${input.locale} ${input.date}`);
  } finally {
    db.close();
  }
}

function resolveReportPath(reportsDir: string, artifactPath: string): string {
  return join(reportsDir, artifactPath.replace(/^reports\//, ''));
}
