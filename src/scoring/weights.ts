export interface ScoringWeights {
  demand_strength: number;
  market_size: number;
  willingness_to_pay: number;
  feasibility: number;
}

export const defaultScoringWeights: ScoringWeights = {
  demand_strength: 0.3,
  market_size: 0.25,
  willingness_to_pay: 0.25,
  feasibility: 0.2
};

export function loadScoringWeights(overrides: Partial<ScoringWeights> = {}): ScoringWeights {
  const weights = { ...defaultScoringWeights, ...overrides };
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return defaultScoringWeights;
  return {
    demand_strength: weights.demand_strength / total,
    market_size: weights.market_size / total,
    willingness_to_pay: weights.willingness_to_pay / total,
    feasibility: weights.feasibility / total
  };
}
