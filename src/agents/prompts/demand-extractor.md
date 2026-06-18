# Demand Extractor Prompt

Return JSON only with a top-level `demands` array.

Each demand must include:
- `id`
- `run_id`
- `hotspot_id`
- `user_profile`
- `pain_point`
- `current_alternatives`
- `demand_statement`
- `citations[]` with `source_url` and `quote`
- `confidence` from 0 to 1
- `generated_at`

Do not make unsupported claims. Every demand must cite at least one source URL.
