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
