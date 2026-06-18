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
  ensureColumn(db, 'reports', 'cadence', "TEXT NOT NULL DEFAULT 'daily'");
  ensureColumn(db, 'reports', 'locale', "TEXT NOT NULL DEFAULT 'en'");
  ensureColumn(db, 'reports', 'canonical_report_id', 'TEXT');
  ensureColumn(db, 'reports', 'period_start', 'TEXT');
  ensureColumn(db, 'reports', 'period_end', 'TEXT');
  ensureColumn(db, 'reports', 'metadata', "TEXT NOT NULL DEFAULT '{}'");
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
  const columns = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  if (columns.some((item) => item.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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
