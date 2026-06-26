import { z } from 'zod';
import type { LlmMessage } from '../integrations/llmClient.js';
import type { Demand, MarketEvidence, ReportLocale, Source, SupplyDemandAnalysis } from '../pipeline/types.js';
import { SupplyDemandAnalysisSchema } from '../pipeline/types.js';
import { fallbackSupplyDemandAnalysis } from '../scoring/supplyDemandFallback.js';

export interface SupplyDemandAnalysisLlm {
  generateJson<T>(schema: z.ZodType<T>, messages: LlmMessage[]): Promise<T>;
}

export interface AnalyzeSupplyDemandOptions {
  demands: Demand[];
  sources: Source[];
  evidence: MarketEvidence[];
  llm: SupplyDemandAnalysisLlm;
  generatedAt: string;
  outputLocale?: ReportLocale;
}

const LooseSupplyDemandAnalysisSchema = z.object({
  id: z.string().optional(),
  run_id: z.string().optional(),
  demand_id: z.string().min(1),
  creator_capability_fit: z.object({
    status: z.enum(['direct', 'orchestrate', 'not_fit']).catch('orchestrate'),
    specific_reason: z.string().optional(),
    details: z.string().optional(),
    missing_capability: z.array(z.string()).default([])
  }).passthrough(),
  existing_supply_fit: z.object({
    status: z.enum(['sufficient', 'partial', 'missing', 'unknown']).catch('unknown'),
    matched_supply: z.string().optional(),
    unresolved_gap: z.string().optional(),
      details: z.string().optional()
  }).passthrough(),
  ai_agent_fill: z.object({
    feasibility: z.enum(['high', 'medium', 'low']).catch('medium'),
    can_do: z.union([z.array(z.string()), z.string()]).default([]),
    cannot_do: z.union([z.array(z.string()), z.string()]).default([]),
    required_inputs: z.union([z.array(z.string()), z.string()]).default([])
  }).passthrough(),
  third_party_supply_path: z.union([
    z.object({
      needed: z.boolean().catch(false),
      provider_type: z.string().nullable().optional(),
      why: z.string().optional(),
      reason: z.string().optional(),
      handoff_boundary: z.string().optional()
    }).passthrough(),
    z.string()
  ]),
  scoring_assessment: z.union([
    z.object({
      demand_strength: z.enum(['high', 'medium', 'low', 'none']).catch('medium'),
      supply_gap: z.enum(['severe', 'clear', 'minor', 'none', 'unknown']).catch('unknown'),
      agent_feasibility: z.enum(['high', 'medium', 'low']).catch('medium'),
      payment_signal: z.enum(['explicit', 'inferred', 'weak', 'none']).catch('weak'),
      evidence_quality: z.enum(['strong', 'medium', 'weak']).catch('weak')
    }).passthrough(),
    z.string()
  ]).optional(),
  confidence: z.number().min(0).max(1).catch(0.55),
  generated_at: z.string().optional()
}).passthrough();

const SupplyDemandAnalysisResponseSchema = z.object({
  analyses: z.array(LooseSupplyDemandAnalysisSchema)
}).strict();

export async function analyzeSupplyDemand(options: AnalyzeSupplyDemandOptions): Promise<SupplyDemandAnalysis[]> {
  if (options.demands.length === 0) return [];
  const languageInstruction = options.outputLocale === 'zh-CN'
    ? 'Target output language for all user-facing fields is Simplified Chinese. Keep product names, URLs, model names, and code identifiers unchanged.'
    : 'Write user-facing fields in the dominant language of the provided demand and source content.';

  const response = await options.llm.generateJson(SupplyDemandAnalysisResponseSchema, [
    {
      role: 'system',
      content: [
        'Return JSON only with a top-level "analyses" array.',
        'You are evaluating demand-supply fit for product opportunities. This is not a marketing copy task.',
        'For each demand, produce exactly one analysis using only the provided demand, source, and market evidence.',
        'Every analysis object must exactly include: id, run_id, demand_id, creator_capability_fit, existing_supply_fit, ai_agent_fill, third_party_supply_path, scoring_assessment, confidence, generated_at.',
        'Use the provided demand ids and run ids. Use the provided generated_at value.',
        'Make every field specific to the exact demand constraints. Do not use generic phrases such as "lead capture", "structured analysis", "prototype generation", or "delivery review" unless the source explicitly supports them.',
        'creator_capability_fit.status must be direct, orchestrate, or not_fit. Treat this as the first step: can the creator fulfill directly and keep most profit? Explain the exact work the creator can own and the exact capability gaps.',
        'ai_agent_fill.feasibility must be high, medium, or low. Treat this as the second step: if direct creator fulfillment is insufficient, can the creator plus AI Agent still fulfill as a self-owned offer? List concrete automatable steps in can_do and concrete boundaries in cannot_do.',
        'existing_supply_fit.status must be sufficient, partial, missing, or unknown. Treat this as the third step: when creator + AI Agent is insufficient, identify source-backed external supply that could fulfill the demand for brokerage/intermediation. Separate named existing tools/providers/workarounds from unresolved gaps.',
        'third_party_supply_path must describe the brokerage path only when external supply is needed: provider type, why, and the handoff boundary where fulfillment leaves the creator/Agent path.',
        'scoring_assessment must be rubric-only labels, not numeric scores. payment_signal is explicit only when the user says they will pay, has budget, or asks for paid service.',
        'If evidence is missing, mark status unknown or weak and explain what evidence is missing. Do not invent supply.',
        languageInstruction
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify({
        generated_at: options.generatedAt,
        demands: options.demands,
        market_evidence: options.evidence,
        sources: options.sources
      })
    }
  ]);

  const demandById = new Map(options.demands.map((demand) => [demand.id, demand]));
  return response.analyses.map((analysis) => {
    const demand = demandById.get(analysis.demand_id);
    if (!demand) throw new Error(`Supply analysis referenced unknown demand id: ${analysis.demand_id}`);
    const fallback = fallbackSupplyDemandAnalysis({
      demand,
      evidence: options.evidence.filter((item) => item.demand_id === demand.id),
      generatedAt: options.generatedAt,
      locale: options.outputLocale
    });
    const scoringAssessment = normalizeScoringAssessment(analysis.scoring_assessment, fallback);
    const thirdPartyPath = normalizeThirdPartyPath(analysis.third_party_supply_path, fallback);
    const creatorReason = analysis.creator_capability_fit.specific_reason ?? analysis.creator_capability_fit.details;
    const existingSupply = analysis.existing_supply_fit.matched_supply ?? analysis.existing_supply_fit.details;
    const existingGap = analysis.existing_supply_fit.unresolved_gap ?? analysis.existing_supply_fit.details;
    return SupplyDemandAnalysisSchema.parse({
      ...analysis,
      id: `supply-analysis-${demand.id}`,
      run_id: demand.run_id,
      demand_id: demand.id,
      creator_capability_fit: {
        status: creatorReason ? analysis.creator_capability_fit.status : fallback.creator_capability_fit.status,
        specific_reason: creatorReason ?? fallback.creator_capability_fit.specific_reason,
        missing_capability: creatorReason && analysis.creator_capability_fit.missing_capability.length > 0
          ? analysis.creator_capability_fit.missing_capability
          : fallback.creator_capability_fit.missing_capability
      },
      existing_supply_fit: {
        status: existingSupply || existingGap ? analysis.existing_supply_fit.status : fallback.existing_supply_fit.status,
        matched_supply: existingSupply ?? fallback.existing_supply_fit.matched_supply,
        unresolved_gap: existingGap ?? fallback.existing_supply_fit.unresolved_gap
      },
      ai_agent_fill: {
        feasibility: analysis.ai_agent_fill.feasibility,
        can_do: toStringArray(analysis.ai_agent_fill.can_do),
        cannot_do: toStringArray(analysis.ai_agent_fill.cannot_do),
        required_inputs: toStringArray(analysis.ai_agent_fill.required_inputs)
      },
      third_party_supply_path: {
        needed: thirdPartyPath.needed,
        provider_type: thirdPartyPath.provider_type,
        why: thirdPartyPath.why,
        handoff_boundary: thirdPartyPath.handoff_boundary
      },
      scoring_assessment: scoringAssessment,
      generated_at: options.generatedAt
    });
  });
}

function toStringArray(value: string[] | string): string[] {
  if (Array.isArray(value)) return value;
  return value.trim().length > 0 ? [value] : [];
}

function normalizeThirdPartyPath(
  value: z.infer<typeof LooseSupplyDemandAnalysisSchema>['third_party_supply_path'],
  fallback: SupplyDemandAnalysis
): SupplyDemandAnalysis['third_party_supply_path'] {
  if (typeof value === 'string') {
    return {
      needed: value.trim().length > 0 && !/不需要|无需|not needed|not required/i.test(value),
      provider_type: value.trim().length > 0 ? value : fallback.third_party_supply_path.provider_type,
      why: value.trim().length > 0 ? value : fallback.third_party_supply_path.why,
      handoff_boundary: fallback.third_party_supply_path.handoff_boundary
    };
  }
  return {
    needed: value.needed,
    provider_type: value.provider_type
      ?? (value.needed ? fallback.third_party_supply_path.provider_type : fallback.third_party_supply_path.provider_type),
    why: value.why ?? value.reason ?? fallback.third_party_supply_path.why,
    handoff_boundary: value.handoff_boundary ?? fallback.third_party_supply_path.handoff_boundary
  };
}

function normalizeScoringAssessment(
  value: z.infer<typeof LooseSupplyDemandAnalysisSchema>['scoring_assessment'],
  fallback: SupplyDemandAnalysis
): SupplyDemandAnalysis['scoring_assessment'] {
  if (value && typeof value !== 'string') {
    return {
      demand_strength: value.demand_strength,
      supply_gap: value.supply_gap,
      agent_feasibility: value.agent_feasibility,
      payment_signal: value.payment_signal,
      evidence_quality: value.evidence_quality
    };
  }
  return fallback.scoring_assessment;
}
