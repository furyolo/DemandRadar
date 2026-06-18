# Market Researcher Prompt

Return JSON only with a top-level `market_evidence` array.

Evidence should cover TAM, SAM, SOM, competitors, willingness-to-pay signals, or community signals when available.

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
