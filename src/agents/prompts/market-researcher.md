# Market Researcher Prompt

Return JSON only with a top-level `market_evidence` array.

Evidence should cover TAM, SAM, SOM, competitors, willingness-to-pay signals, or community signals when available.

Prioritize competitor evidence that explains whether existing supply can satisfy the demand, which supply gaps remain, and whether an AI Agent could fill those gaps enough to enable a transaction.

Each item must include:
- `id`
- `run_id`
- `demand_id`
- `evidence_type`
- `value`
- `source_url`
- `search_query`
- `time_window`
- `confidence` from 0 to 1
- `generated_at`

Mark uncertainty through lower confidence. Do not include evidence without a source URL.

Include at least one `competitor` item when source-backed supply evidence exists. Return no competitor evidence rather than inventing a supply-side claim.
