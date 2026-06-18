import type { Command } from 'commander';
import { openDatabase } from '../storage/database.js';
import { DemandRadarRepository } from '../storage/repositories.js';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List ranked demand scores for a run.')
    .requiredOption('--run <runId>', 'Run id')
    .option('--limit <number>', 'Result limit', '10')
    .option('--db <path>', 'SQLite database path', process.env.DEMANDRADAR_DB_PATH ?? 'data/demandradar.sqlite')
    .action((options) => {
      const db = openDatabase(options.db);
      try {
        const repository = new DemandRadarRepository(db);
        const scores = repository.listTopScores(options.run, Number(options.limit));
        for (const score of scores) {
          console.log(`${score.demand_id}\t${score.total_score}\t${score.explanation}`);
        }
      } finally {
        db.close();
      }
    });
}
