import { z } from 'zod';

export const DomainSchema = z.enum([
  'technology',
  'consumer',
  'policy',
  'social_events',
  'global_expansion',
  'ai_applications',
  'social_media',
  'rednote'
]);

export const RunSchema = z.object({
  id: z.string().min(1),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable().default(null),
  status: z.enum(['running', 'completed', 'failed']),
  query_window_days: z.number().int().positive(),
  top_hotspot_limit: z.number().int().positive(),
  metadata: z.record(z.string(), z.unknown()).default({})
}).strict();

export const SourceSchema = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  source_url: z.string().url(),
  title: z.string().min(1),
  snippet: z.string().default(''),
  source_name: z.string().default('unknown'),
  published_at: z.string().nullable().default(null),
  search_query: z.string().min(1),
  time_window: z.string().min(1),
  raw: z.record(z.string(), z.unknown()).default({})
}).strict();

export const HotspotSchema = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().default(''),
  domain: DomainSchema,
  source_ids: z.array(z.string().min(1)).min(1),
  canonical_url: z.string().url().nullable().default(null),
  heat_score: z.number().min(0).max(100),
  search_query: z.string().min(1),
  time_window: z.string().min(1),
  generated_at: z.string().datetime()
}).strict();

export const DemandSchema = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  hotspot_id: z.string().min(1),
  user_profile: z.string().min(1),
  pain_point: z.string().min(1),
  current_alternatives: z.array(z.string()).default([]),
  demand_statement: z.string().min(1),
  citations: z.array(z.object({
    source_url: z.string().url(),
    quote: z.string().default('')
  }).strict()).min(1),
  confidence: z.number().min(0).max(1),
  generated_at: z.string().datetime()
}).strict();

export const MarketEvidenceSchema = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  demand_id: z.string().min(1),
  evidence_type: z.enum(['tam', 'sam', 'som', 'competitor', 'willingness_to_pay', 'community_signal']),
  value: z.string().min(1),
  source_url: z.string().url(),
  search_query: z.string().min(1),
  time_window: z.string().min(1),
  confidence: z.number().min(0).max(1),
  generated_at: z.string().datetime()
}).strict();

export const ScoreSchema = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  demand_id: z.string().min(1),
  dimension_scores: z.object({
    demand_strength: z.number().min(0).max(100),
    market_size: z.number().min(0).max(100),
    willingness_to_pay: z.number().min(0).max(100),
    feasibility: z.number().min(0).max(100)
  }).strict(),
  total_score: z.number().min(0).max(100),
  explanation: z.string().min(1),
  confidence: z.number().min(0).max(1),
  generated_at: z.string().datetime()
}).strict();

export const ReportCadenceSchema = z.enum(['daily', 'weekly', 'monthly']);
export const ReportLocaleSchema = z.enum(['en', 'zh-CN']);

export const ReportArtifactSchema = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  report_type: z.enum(['daily', 'mini_brief', 'weekly', 'monthly']),
  demand_id: z.string().nullable().default(null),
  cadence: ReportCadenceSchema.optional(),
  locale: ReportLocaleSchema.optional(),
  canonical_report_id: z.string().nullable().optional(),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
  path: z.string().min(1),
  title: z.string().min(1),
  generated_at: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional()
}).strict();

export const PipelineResultSchema = z.object({
  run: RunSchema,
  sources: z.array(SourceSchema),
  hotspots: z.array(HotspotSchema),
  demands: z.array(DemandSchema),
  market_evidence: z.array(MarketEvidenceSchema),
  scores: z.array(ScoreSchema),
  reports: z.array(ReportArtifactSchema)
}).strict();

export type DemandDomain = z.infer<typeof DomainSchema>;
export type DemandRadarRun = z.infer<typeof RunSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Hotspot = z.infer<typeof HotspotSchema>;
export type Demand = z.infer<typeof DemandSchema>;
export type MarketEvidence = z.infer<typeof MarketEvidenceSchema>;
export type Score = z.infer<typeof ScoreSchema>;
export type ReportCadence = z.infer<typeof ReportCadenceSchema>;
export type ReportLocale = z.infer<typeof ReportLocaleSchema>;
export type ReportArtifact = z.infer<typeof ReportArtifactSchema>;
export type PipelineResult = z.infer<typeof PipelineResultSchema>;
