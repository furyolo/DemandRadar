import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  started_at: text('started_at').notNull(),
  completed_at: text('completed_at'),
  status: text('status').notNull(),
  query_window_days: integer('query_window_days').notNull(),
  top_hotspot_limit: integer('top_hotspot_limit').notNull(),
  metadata: text('metadata').notNull()
});

export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  run_id: text('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  source_url: text('source_url').notNull(),
  title: text('title').notNull(),
  snippet: text('snippet').notNull(),
  source_name: text('source_name').notNull(),
  published_at: text('published_at'),
  search_query: text('search_query').notNull(),
  time_window: text('time_window').notNull(),
  raw: text('raw').notNull()
}, (table) => [
  index('idx_sources_run_id').on(table.run_id)
]);

export const hotspots = sqliteTable('hotspots', {
  id: text('id').primaryKey(),
  run_id: text('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  domain: text('domain').notNull(),
  source_ids: text('source_ids').notNull(),
  canonical_url: text('canonical_url'),
  heat_score: real('heat_score').notNull(),
  search_query: text('search_query').notNull(),
  time_window: text('time_window').notNull(),
  generated_at: text('generated_at').notNull()
}, (table) => [
  index('idx_hotspots_run_id').on(table.run_id)
]);

export const demands = sqliteTable('demands', {
  id: text('id').primaryKey(),
  run_id: text('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  hotspot_id: text('hotspot_id').notNull().references(() => hotspots.id, { onDelete: 'cascade' }),
  user_profile: text('user_profile').notNull(),
  pain_point: text('pain_point').notNull(),
  current_alternatives: text('current_alternatives').notNull(),
  demand_statement: text('demand_statement').notNull(),
  citations: text('citations').notNull(),
  confidence: real('confidence').notNull(),
  generated_at: text('generated_at').notNull()
}, (table) => [
  index('idx_demands_run_id').on(table.run_id)
]);

export const marketEvidence = sqliteTable('market_evidence', {
  id: text('id').primaryKey(),
  run_id: text('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  demand_id: text('demand_id').notNull().references(() => demands.id, { onDelete: 'cascade' }),
  evidence_type: text('evidence_type').notNull(),
  value: text('value').notNull(),
  source_url: text('source_url').notNull(),
  search_query: text('search_query').notNull(),
  time_window: text('time_window').notNull(),
  confidence: real('confidence').notNull(),
  generated_at: text('generated_at').notNull()
}, (table) => [
  index('idx_market_evidence_demand_id').on(table.demand_id)
]);

export const scores = sqliteTable('scores', {
  id: text('id').primaryKey(),
  run_id: text('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  demand_id: text('demand_id').notNull().references(() => demands.id, { onDelete: 'cascade' }),
  dimension_scores: text('dimension_scores').notNull(),
  total_score: real('total_score').notNull(),
  explanation: text('explanation').notNull(),
  confidence: real('confidence').notNull(),
  generated_at: text('generated_at').notNull()
}, (table) => [
  index('idx_scores_run_total').on(table.run_id, table.total_score)
]);

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  run_id: text('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  report_type: text('report_type').notNull(),
  demand_id: text('demand_id'),
  path: text('path').notNull(),
  title: text('title').notNull(),
  generated_at: text('generated_at').notNull()
}, (table) => [
  index('idx_reports_run_id').on(table.run_id)
]);

export const createSchemaSql = `
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  query_window_days INTEGER NOT NULL,
  top_hotspot_limit INTEGER NOT NULL,
  metadata TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  snippet TEXT NOT NULL,
  source_name TEXT NOT NULL,
  published_at TEXT,
  search_query TEXT NOT NULL,
  time_window TEXT NOT NULL,
  raw TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hotspots (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  domain TEXT NOT NULL,
  source_ids TEXT NOT NULL,
  canonical_url TEXT,
  heat_score REAL NOT NULL,
  search_query TEXT NOT NULL,
  time_window TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS demands (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  hotspot_id TEXT NOT NULL REFERENCES hotspots(id) ON DELETE CASCADE,
  user_profile TEXT NOT NULL,
  pain_point TEXT NOT NULL,
  current_alternatives TEXT NOT NULL,
  demand_statement TEXT NOT NULL,
  citations TEXT NOT NULL,
  confidence REAL NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_evidence (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  demand_id TEXT NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  value TEXT NOT NULL,
  source_url TEXT NOT NULL,
  search_query TEXT NOT NULL,
  time_window TEXT NOT NULL,
  confidence REAL NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  demand_id TEXT NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  dimension_scores TEXT NOT NULL,
  total_score REAL NOT NULL,
  explanation TEXT NOT NULL,
  confidence REAL NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  demand_id TEXT,
  path TEXT NOT NULL,
  title TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sources_run_id ON sources(run_id);
CREATE INDEX IF NOT EXISTS idx_hotspots_run_id ON hotspots(run_id);
CREATE INDEX IF NOT EXISTS idx_demands_run_id ON demands(run_id);
CREATE INDEX IF NOT EXISTS idx_market_evidence_demand_id ON market_evidence(demand_id);
CREATE INDEX IF NOT EXISTS idx_scores_run_total ON scores(run_id, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_reports_run_id ON reports(run_id);
`;
