import Database from 'better-sqlite3';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createSchemaSql } from './schema.js';

export type DemandRadarDatabase = Database.Database;

export function migrateDatabase(db: DemandRadarDatabase): void {
  db.pragma('foreign_keys = ON');
  db.exec(createSchemaSql);
}

export function openDatabase(path = ':memory:'): DemandRadarDatabase {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  migrateDatabase(db);
  return db;
}

export function closeDatabase(db: DemandRadarDatabase): void {
  db.close();
}
