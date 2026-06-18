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
