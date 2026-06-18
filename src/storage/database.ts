import Database from 'better-sqlite3';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { createSchemaSql } from './schema.js';
import * as schema from './schema.js';

export interface DemandRadarDatabase {
  sqlite: Database.Database;
  orm: BetterSQLite3Database<typeof schema>;
  close: () => void;
}

export function migrateDatabase(db: Database.Database): void {
  db.pragma('foreign_keys = ON');
  // Storage-layer bootstrap escape hatch. Future schema changes should move to Drizzle migrations.
  db.exec(createSchemaSql);
}

export function openDatabase(path = ':memory:'): DemandRadarDatabase {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  migrateDatabase(db);
  return {
    sqlite: db,
    orm: drizzle(db, { schema }),
    close: () => db.close()
  };
}

export function closeDatabase(db: DemandRadarDatabase): void {
  db.close();
}
