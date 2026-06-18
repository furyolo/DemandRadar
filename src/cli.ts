import { Command } from 'commander';
import { registerListCommand } from './commands/list.js';
import { registerReportCommand } from './commands/report.js';
import { registerRunCommand } from './commands/run.js';
import { registerShowCommand } from './commands/show.js';
import { loadDemandRadarEnv } from './config/env.js';

export function buildCli(): Command {
  const program = new Command();

  program
    .name('demandradar')
    .description('Discover product opportunities from recent internet demand signals.')
    .version('0.1.0');

  registerRunCommand(program);
  registerListCommand(program);
  registerShowCommand(program);
  registerReportCommand(program);

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  loadDemandRadarEnv();
  await buildCli().parseAsync(argv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
