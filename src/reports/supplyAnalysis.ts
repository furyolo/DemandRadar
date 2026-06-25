import type { Demand, MarketEvidence, Score } from '../pipeline/types.js';

export interface SupplyAnalysis {
  existingSupply: string;
  supplyGap: string;
  aiAgentFill: string;
  transactionPath: string;
}

export function analyzeSupplyFit(input: {
  demand: Demand;
  evidence: MarketEvidence[];
  score: Score;
}): SupplyAnalysis {
  const competitorEvidence = input.evidence.filter((item) => item.evidence_type === 'competitor');
  const visibleAlternatives = input.demand.current_alternatives.filter((item) => item.trim().length > 0);
  const visibleSupply = [
    ...visibleAlternatives.map((item) => `current alternative: ${item}`),
    ...competitorEvidence.map((item) => `competitor evidence: ${item.value}`)
  ];

  const existingSupply = visibleSupply.length > 0
    ? `Visible but incomplete - ${visibleSupply.slice(0, 3).join('; ')}`
    : 'No source-backed existing supply identified in this run';
  const supplyGap = visibleSupply.length > 0
    ? `Validate whether visible supply resolves the stated pain point: ${input.demand.pain_point}`
    : `Supply discovery gap - no current provider or workaround was captured for: ${input.demand.pain_point}`;
  const aiAgentFill = aiAgentPotential(input.score.dimension_scores.feasibility, visibleSupply.length > 0);
  const transactionPath = visibleSupply.length > 0
    ? 'Route demand to existing supply first, then use an AI Agent to qualify intent, compare fit, and fill unresolved workflow steps.'
    : 'Use an AI Agent as provisional supply for intake, workflow execution, and handoff until repeatable human or software supply is validated.';

  return {
    existingSupply,
    supplyGap,
    aiAgentFill,
    transactionPath
  };
}

function aiAgentPotential(feasibility: number, hasVisibleSupply: boolean): string {
  if (feasibility >= 85) {
    return hasVisibleSupply
      ? 'High - automate qualification, matching, coordination, and last-mile execution around existing supply.'
      : 'High - build an AI Agent to cover intake, analysis, execution, and delivery while supply is validated.';
  }
  if (feasibility >= 70) {
    return hasVisibleSupply
      ? 'Medium - use an AI Agent for qualification and workflow assistance, with manual review for fulfillment quality.'
      : 'Medium - AI Agent can cover structured workflow steps, but fulfillment assumptions need manual validation.';
  }
  return 'Low - demand may require non-AI supply, regulated fulfillment, or deeper operational validation before matching.';
}
