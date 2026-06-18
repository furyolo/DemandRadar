import type { Command } from 'commander';
import { openDatabase } from '../storage/database.js';
import { DemandRadarRepository } from '../storage/repositories.js';

export function registerShowCommand(program: Command): void {
  program
    .command('show')
    .description('Show a stored demand detail.')
    .argument('<demandId>', 'Demand id')
    .option('--db <path>', 'SQLite database path', process.env.DEMANDRADAR_DB_PATH ?? 'data/demandradar.sqlite')
    .action((demandId: string, options) => {
      const db = openDatabase(options.db);
      try {
        const repository = new DemandRadarRepository(db);
        const demand = repository.getDemandDetail(demandId);
        if (!demand) throw new Error(`Demand not found: ${demandId}`);
        console.log(JSON.stringify(demand, null, 2));
      } finally {
        db.close();
      }
    });
}
