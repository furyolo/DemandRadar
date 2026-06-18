import { count, desc, eq } from 'drizzle-orm';
import type { DemandRadarDatabase } from './database.js';
import {
  demands as demandsTable,
  hotspots as hotspotsTable,
  marketEvidence as marketEvidenceTable,
  reports as reportsTable,
  runs as runsTable,
  scores as scoresTable,
  sources as sourcesTable
} from './schema.js';
import { RunSchema } from '../pipeline/types.js';
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
    this.db.orm.insert(runsTable).values({ ...run, metadata: encode(run.metadata) }).run();
  }

  saveSources(sources: Source[]): void {
    if (sources.length === 0) return;
    this.db.orm.insert(sourcesTable).values(sources.map((source) => ({ ...source, raw: encode(source.raw) }))).run();
  }

  saveHotspots(hotspots: Hotspot[]): void {
    if (hotspots.length === 0) return;
    this.db.orm.insert(hotspotsTable).values(hotspots.map((hotspot) => ({ ...hotspot, source_ids: encode(hotspot.source_ids) }))).run();
  }

  saveDemands(demands: Demand[]): void {
    if (demands.length === 0) return;
    this.db.orm.insert(demandsTable).values(demands.map((demand) => ({
      ...demand,
      current_alternatives: encode(demand.current_alternatives),
      citations: encode(demand.citations)
    }))).run();
  }

  saveMarketEvidence(evidence: MarketEvidence[]): void {
    if (evidence.length === 0) return;
    this.db.orm.insert(marketEvidenceTable).values(evidence).run();
  }

  saveScores(scores: Score[]): void {
    if (scores.length === 0) return;
    this.db.orm.insert(scoresTable).values(scores.map((score) => ({ ...score, dimension_scores: encode(score.dimension_scores) }))).run();
  }

  saveReportArtifact(report: ReportArtifact): void {
    this.db.orm.insert(reportsTable).values(report).run();
  }

  savePipelineResult(result: PipelineResult): void {
    this.db.orm.transaction((tx) => {
      tx.insert(runsTable).values({ ...result.run, metadata: encode(result.run.metadata) }).run();
      if (result.sources.length > 0) {
        tx.insert(sourcesTable).values(result.sources.map((source) => ({ ...source, raw: encode(source.raw) }))).run();
      }
      if (result.hotspots.length > 0) {
        tx.insert(hotspotsTable).values(result.hotspots.map((hotspot) => ({ ...hotspot, source_ids: encode(hotspot.source_ids) }))).run();
      }
      if (result.demands.length > 0) {
        tx.insert(demandsTable).values(result.demands.map((demand) => ({
          ...demand,
          current_alternatives: encode(demand.current_alternatives),
          citations: encode(demand.citations)
        }))).run();
      }
      if (result.market_evidence.length > 0) tx.insert(marketEvidenceTable).values(result.market_evidence).run();
      if (result.scores.length > 0) {
        tx.insert(scoresTable).values(result.scores.map((score) => ({ ...score, dimension_scores: encode(score.dimension_scores) }))).run();
      }
      if (result.reports.length > 0) tx.insert(reportsTable).values(result.reports).run();
    });
  }

  listTopScores(runId: string, limit = 10): Score[] {
    const rows = this.db.orm
      .select()
      .from(scoresTable)
      .where(eq(scoresTable.run_id, runId))
      .orderBy(desc(scoresTable.total_score), desc(scoresTable.confidence))
      .limit(limit)
      .all();
    return rows.map((row) => ({ ...row, dimension_scores: decode<Score['dimension_scores']>(row.dimension_scores) }));
  }

  getDemandDetail(demandId: string): Demand | null {
    const row = this.db.orm.select().from(demandsTable).where(eq(demandsTable.id, demandId)).get();
    if (!row) return null;
    return {
      ...row,
      current_alternatives: decode<string[]>(row.current_alternatives),
      citations: decode<Demand['citations']>(row.citations)
    };
  }

  getRunSummary(runId: string): { run: DemandRadarRun | null; report_count: number; demand_count: number } {
    const runRow = this.db.orm.select().from(runsTable).where(eq(runsTable.id, runId)).get();
    const report_count = this.db.orm.select({ count: count() }).from(reportsTable).where(eq(reportsTable.run_id, runId)).get()?.count ?? 0;
    const demand_count = this.db.orm.select({ count: count() }).from(demandsTable).where(eq(demandsTable.run_id, runId)).get()?.count ?? 0;
    return {
      run: runRow ? RunSchema.parse({ ...runRow, metadata: decode<Record<string, unknown>>(runRow.metadata) }) : null,
      report_count,
      demand_count
    };
  }

  getLatestRunId(): string | null {
    return this.db.orm
      .select({ id: runsTable.id })
      .from(runsTable)
      .orderBy(desc(runsTable.started_at))
      .limit(1)
      .get()?.id ?? null;
  }

  listDemands(runId: string, limit = 100): Demand[] {
    return this.db.orm
      .select()
      .from(demandsTable)
      .where(eq(demandsTable.run_id, runId))
      .orderBy(demandsTable.id)
      .limit(limit)
      .all()
      .map((row) => ({
        ...row,
        current_alternatives: decode<string[]>(row.current_alternatives),
        citations: decode<Demand['citations']>(row.citations)
      }));
  }

  listSources(runId: string): Source[] {
    return this.db.orm
      .select()
      .from(sourcesTable)
      .where(eq(sourcesTable.run_id, runId))
      .orderBy(sourcesTable.id)
      .all()
      .map((row) => ({ ...row, raw: decode<Source['raw']>(row.raw) }));
  }
}
