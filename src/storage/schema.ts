import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

export const supplyAnalyses = sqliteTable('supply_analyses', {
  id: text('id').primaryKey(),
  run_id: text('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  demand_id: text('demand_id').notNull().references(() => demands.id, { onDelete: 'cascade' }),
  analysis: text('analysis').notNull(),
  generated_at: text('generated_at').notNull()
}, (table) => [
  index('idx_supply_analyses_run_id').on(table.run_id),
  index('idx_supply_analyses_demand_id').on(table.demand_id)
]);

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  run_id: text('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  report_type: text('report_type').notNull(),
  demand_id: text('demand_id'),
  cadence: text('cadence').notNull().default('daily'),
  locale: text('locale').notNull().default('en'),
  canonical_report_id: text('canonical_report_id'),
  period_start: text('period_start'),
  period_end: text('period_end'),
  path: text('path').notNull(),
  title: text('title').notNull(),
  generated_at: text('generated_at').notNull(),
  metadata: text('metadata').notNull().default('{}')
}, (table) => [
  index('idx_reports_run_id').on(table.run_id),
  index('idx_reports_cadence_locale_period').on(table.cadence, table.locale, table.period_start, table.period_end),
  index('idx_reports_canonical_report_id').on(table.canonical_report_id)
]);

export const brokerageSupplyItems = sqliteTable('brokerage_supply_items', {
  id: text('id').primaryKey(),
  platform: text('platform').notNull(),
  source_key: text('source_key').notNull(),
  source_url: text('source_url').notNull(),
  title: text('title').notNull(),
  seller: text('seller'),
  price: text('price'),
  location: text('location'),
  raw: text('raw').notNull(),
  first_seen_at: text('first_seen_at').notNull(),
  last_seen_at: text('last_seen_at').notNull(),
  seen_count: integer('seen_count').notNull(),
  status: text('status').notNull()
}, (table) => [
  uniqueIndex('idx_brokerage_supply_source_key').on(table.source_key),
  index('idx_brokerage_supply_status').on(table.status),
  index('idx_brokerage_supply_last_seen').on(table.last_seen_at)
]);

export const fiverrGigDrafts = sqliteTable('fiverr_gig_drafts', {
  id: text('id').primaryKey(),
  supply_item_id: text('supply_item_id').notNull().references(() => brokerageSupplyItems.id, { onDelete: 'cascade' }),
  form_fill_map: text('form_fill_map').notNull(),
  markdown_path: text('markdown_path').notNull(),
  markdown: text('markdown').notNull(),
  asset_paths: text('asset_paths').notNull(),
  pricing_assumptions: text('pricing_assumptions').notNull(),
  status: text('status').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
}, (table) => [
  index('idx_fiverr_gig_drafts_supply_item_id').on(table.supply_item_id),
  index('idx_fiverr_gig_drafts_status').on(table.status),
  index('idx_fiverr_gig_drafts_updated_at').on(table.updated_at)
]);

export const fiverrUploadEvents = sqliteTable('fiverr_upload_events', {
  id: text('id').primaryKey(),
  draft_id: text('draft_id').notNull().references(() => fiverrGigDrafts.id, { onDelete: 'cascade' }),
  event_type: text('event_type').notNull(),
  fiverr_gig_url: text('fiverr_gig_url'),
  note: text('note'),
  created_at: text('created_at').notNull()
}, (table) => [
  index('idx_fiverr_upload_events_draft_id').on(table.draft_id),
  index('idx_fiverr_upload_events_created_at').on(table.created_at)
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

CREATE TABLE IF NOT EXISTS supply_analyses (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  demand_id TEXT NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  analysis TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  demand_id TEXT,
  cadence TEXT NOT NULL DEFAULT 'daily',
  locale TEXT NOT NULL DEFAULT 'en',
  canonical_report_id TEXT,
  period_start TEXT,
  period_end TEXT,
  path TEXT NOT NULL,
  title TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sources_run_id ON sources(run_id);
CREATE INDEX IF NOT EXISTS idx_hotspots_run_id ON hotspots(run_id);
CREATE INDEX IF NOT EXISTS idx_demands_run_id ON demands(run_id);
CREATE INDEX IF NOT EXISTS idx_market_evidence_demand_id ON market_evidence(demand_id);
CREATE INDEX IF NOT EXISTS idx_scores_run_total ON scores(run_id, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_supply_analyses_run_id ON supply_analyses(run_id);
CREATE INDEX IF NOT EXISTS idx_supply_analyses_demand_id ON supply_analyses(demand_id);
CREATE INDEX IF NOT EXISTS idx_reports_run_id ON reports(run_id);
CREATE INDEX IF NOT EXISTS idx_reports_cadence_locale_period ON reports(cadence, locale, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_reports_canonical_report_id ON reports(canonical_report_id);

CREATE TABLE IF NOT EXISTS brokerage_supply_items (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  source_key TEXT NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  seller TEXT,
  price TEXT,
  location TEXT,
  raw TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  seen_count INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fiverr_gig_drafts (
  id TEXT PRIMARY KEY,
  supply_item_id TEXT NOT NULL REFERENCES brokerage_supply_items(id) ON DELETE CASCADE,
  form_fill_map TEXT NOT NULL,
  markdown_path TEXT NOT NULL,
  markdown TEXT NOT NULL,
  asset_paths TEXT NOT NULL,
  pricing_assumptions TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fiverr_upload_events (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES fiverr_gig_drafts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  fiverr_gig_url TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brokerage_supply_source_key ON brokerage_supply_items(source_key);
CREATE INDEX IF NOT EXISTS idx_brokerage_supply_status ON brokerage_supply_items(status);
CREATE INDEX IF NOT EXISTS idx_brokerage_supply_last_seen ON brokerage_supply_items(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_fiverr_gig_drafts_supply_item_id ON fiverr_gig_drafts(supply_item_id);
CREATE INDEX IF NOT EXISTS idx_fiverr_gig_drafts_status ON fiverr_gig_drafts(status);
CREATE INDEX IF NOT EXISTS idx_fiverr_gig_drafts_updated_at ON fiverr_gig_drafts(updated_at);
CREATE INDEX IF NOT EXISTS idx_fiverr_upload_events_draft_id ON fiverr_upload_events(draft_id);
CREATE INDEX IF NOT EXISTS idx_fiverr_upload_events_created_at ON fiverr_upload_events(created_at);
`;
