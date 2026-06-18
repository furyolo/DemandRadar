import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .description('Print a Markdown report path or content.')
    .argument('[date]', 'Report date', new Date().toISOString().slice(0, 10))
    .option('--reports-dir <path>', 'Reports output directory', process.env.REPORTS_DIR ?? 'reports')
    .option('--print', 'Print report contents')
    .action((date: string, options) => {
      const path = join(options.reportsDir, `${date}.md`);
      if (options.print) {
        console.log(readFileSync(path, 'utf8'));
      } else {
        console.log(path);
      }
    });
}
