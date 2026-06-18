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
