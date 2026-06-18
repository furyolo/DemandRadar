import type { DemandRadarDatabase } from './database.js';
import type {
  Demand,
  DemandRadarRun,
  Hotspot,
  MarketEvidence,
  PipelineResult,
  ReportArtifact,
  Score,
  Source
} from '../pipeline/types.js';

function encode(value: unknown): string {
  return JSON.stringify(value);
}

function decode<T>(value: string): T {
  return JSON.parse(value) as T;
}

export class DemandRadarRepository {
  constructor(private readonly db: DemandRadarDatabase) {}

  createRun(run: DemandRadarRun): void {
    this.db.prepare(`
      INSERT INTO runs (id, started_at, completed_at, status, query_window_days, top_hotspot_limit, metadata)
      VALUES (@id, @started_at, @completed_at, @status, @query_window_days, @top_hotspot_limit, @metadata)
    `).run({ ...run, metadata: encode(run.metadata) });
  }

  saveSources(sources: Source[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO sources (id, run_id, source_url, title, snippet, source_name, published_at, search_query, time_window, raw)
      VALUES (@id, @run_id, @source_url, @title, @snippet, @source_name, @published_at, @search_query, @time_window, @raw)
    `);
    const tx = this.db.transaction((items: Source[]) => {
      for (const source of items) stmt.run({ ...source, raw: encode(source.raw) });
    });
    tx(sources);
  }

  saveHotspots(hotspots: Hotspot[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO hotspots (id, run_id, title, summary, domain, source_ids, canonical_url, heat_score, search_query, time_window, generated_at)
      VALUES (@id, @run_id, @title, @summary, @domain, @source_ids, @canonical_url, @heat_score, @search_query, @time_window, @generated_at)
    `);
    const tx = this.db.transaction((items: Hotspot[]) => {
      for (const hotspot of items) stmt.run({ ...hotspot, source_ids: encode(hotspot.source_ids) });
    });
    tx(hotspots);
  }

  saveDemands(demands: Demand[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO demands (id, run_id, hotspot_id, user_profile, pain_point, current_alternatives, demand_statement, citations, confidence, generated_at)
      VALUES (@id, @run_id, @hotspot_id, @user_profile, @pain_point, @current_alternatives, @demand_statement, @citations, @confidence, @generated_at)
    `);
    const tx = this.db.transaction((items: Demand[]) => {
      for (const demand of items) {
        stmt.run({
          ...demand,
          current_alternatives: encode(demand.current_alternatives),
          citations: encode(demand.citations)
        });
      }
    });
    tx(demands);
  }

  saveMarketEvidence(evidence: MarketEvidence[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO market_evidence (id, run_id, demand_id, evidence_type, value, source_url, search_query, time_window, confidence, generated_at)
      VALUES (@id, @run_id, @demand_id, @evidence_type, @value, @source_url, @search_query, @time_window, @confidence, @generated_at)
    `);
    const tx = this.db.transaction((items: MarketEvidence[]) => {
      for (const item of items) stmt.run(item);
    });
    tx(evidence);
  }

  saveScores(scores: Score[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO scores (id, run_id, demand_id, dimension_scores, total_score, explanation, confidence, generated_at)
      VALUES (@id, @run_id, @demand_id, @dimension_scores, @total_score, @explanation, @confidence, @generated_at)
    `);
    const tx = this.db.transaction((items: Score[]) => {
      for (const score of items) stmt.run({ ...score, dimension_scores: encode(score.dimension_scores) });
    });
    tx(scores);
  }

  saveReportArtifact(report: ReportArtifact): void {
    this.db.prepare(`
      INSERT INTO reports (id, run_id, report_type, demand_id, path, title, generated_at)
      VALUES (@id, @run_id, @report_type, @demand_id, @path, @title, @generated_at)
    `).run(report);
  }

  savePipelineResult(result: PipelineResult): void {
    const tx = this.db.transaction(() => {
      this.createRun(result.run);
      this.saveSources(result.sources);
      this.saveHotspots(result.hotspots);
      this.saveDemands(result.demands);
      this.saveMarketEvidence(result.market_evidence);
      this.saveScores(result.scores);
      for (const report of result.reports) this.saveReportArtifact(report);
    });
    tx();
  }

  listTopScores(runId: string, limit = 10): Score[] {
    const rows = this.db.prepare(`
      SELECT * FROM scores WHERE run_id = ? ORDER BY total_score DESC, confidence DESC LIMIT ?
    `).all(runId, limit) as Array<Omit<Score, 'dimension_scores'> & { dimension_scores: string }>;
    return rows.map((row) => ({ ...row, dimension_scores: decode<Score['dimension_scores']>(row.dimension_scores) }));
  }

  getDemandDetail(demandId: string): Demand | null {
    const row = this.db.prepare('SELECT * FROM demands WHERE id = ?').get(demandId) as
      | (Omit<Demand, 'current_alternatives' | 'citations'> & { current_alternatives: string; citations: string })
      | undefined;
    if (!row) return null;
    return {
      ...row,
      current_alternatives: decode<string[]>(row.current_alternatives),
      citations: decode<Demand['citations']>(row.citations)
    };
  }

  getRunSummary(runId: string): { run: DemandRadarRun | null; report_count: number; demand_count: number } {
    const runRow = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as
      | (Omit<DemandRadarRun, 'metadata'> & { metadata: string })
      | undefined;
    const report_count = (this.db.prepare('SELECT COUNT(*) AS count FROM reports WHERE run_id = ?').get(runId) as { count: number }).count;
    const demand_count = (this.db.prepare('SELECT COUNT(*) AS count FROM demands WHERE run_id = ?').get(runId) as { count: number }).count;
    return {
      run: runRow ? { ...runRow, metadata: decode<Record<string, unknown>>(runRow.metadata) } : null,
      report_count,
      demand_count
    };
  }
}
