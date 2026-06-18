# TASK-001 Summary

Implemented `researchMarketEvidenceBatch` in `src/agents/marketResearcher.ts`.

Evidence:
- Added batch options for multiple demands with shared sources.
- Preserved `researchMarketEvidence` as the single-demand API by delegating to batch with one demand.
- Normalized `market_evidence.id`, `run_id`, and `demand_id` in code to avoid LLM-generated primary key and foreign key errors.
- Added test coverage in `tests/agents.test.ts` for batch id and foreign key normalization.

Verification:
- `npm run typecheck`
- `npm test`
*** Add File: /home/andy/code/DemandRadar/.workflow/scratch/20260618-quick-market-evidence-micro-batch/.summaries/TASK-002-summary.md
# TASK-002 Summary

Wired market evidence micro-batching into the live pipeline and CLI.

Evidence:
- Added `marketEvidenceBatchSize` and `marketEvidenceConcurrency` options to `runPipeline`.
- Defaulted batch size and concurrency to `3`.
- Added batch fallback: failed batches degrade to per-demand calls.
- Added CLI flags `--market-batch-size` and `--market-concurrency`.
- Verified real live run at `/tmp/demandradar-batch-verify-wqwLQY` with 10 sources, 10 hotspots, 10 demands, 36 market evidence records, 10 scores, and 4 reports.

Verification:
- `npm run demandradar:run -- --date 2026-06-18 --limit 10 --db /tmp/demandradar-batch-verify-wqwLQY/demandradar.sqlite --reports-dir /tmp/demandradar-batch-verify-wqwLQY/reports --briefs-dir /tmp/demandradar-batch-verify-wqwLQY/briefs`
- `npm run typecheck`
- `npm test`
*** Add File: /home/andy/code/DemandRadar/.workflow/scratch/20260618-quick-market-evidence-micro-batch/.summaries/TASK-003-summary.md
# TASK-003 Summary

Added an A/B comparison script and fixed a report path issue found during live verification.

Evidence:
- Added `scripts/market-evidence-ab.ts`.
- Added `npm run market:ab`.
- Script loads the same SQLite run demands and sources, then compares `single-concurrent` vs `micro-batch`.
- Live A/B sample on 3 demands produced 9 evidence records for both strategies; single-concurrent took 40259 ms, micro-batch took 52166 ms, with no failures and no fallback batches.
- Fixed Mini Brief slug fallback for non-ASCII demand statements in `src/reports/miniBrief.ts`.
- Added report test ensuring non-ASCII titles use demand id paths instead of `brief.md`.

Verification:
- `npm run market:ab -- --db /tmp/demandradar-batch-verify-wqwLQY/demandradar.sqlite --run run-122b4ce5-c5a6-4176-9456-838f712064a7 --limit 3 --batch-size 3 --concurrency 3`
- `npm run typecheck`
- `npm test`
