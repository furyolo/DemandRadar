# TASK-001 Summary

Added Drizzle ORM storage foundation.

Evidence:
- Installed `drizzle-orm` and `drizzle-kit`.
- Added Drizzle table definitions for runs, sources, hotspots, demands, market evidence, scores, and reports in `src/storage/schema.ts`.
- Added `drizzle.config.ts`.
- Updated `openDatabase` in `src/storage/database.ts` to expose a Drizzle ORM instance while preserving `db.close()` usage.
- Kept existing schema bootstrap isolated as a storage-layer migration escape hatch with an explicit comment.

Verification:
- `npm run typecheck`
- `npx drizzle-kit check --config drizzle.config.ts`
*** Add File: /home/andy/code/DemandRadar/.workflow/scratch/20260618-quick-drizzle-orm-storage/.summaries/TASK-002-summary.md
# TASK-002 Summary

Migrated repository reads and writes to Drizzle.

Evidence:
- Replaced repository `db.prepare(...)` calls with Drizzle insert/select/transaction APIs in `src/storage/repositories.ts`.
- Preserved public methods: `savePipelineResult`, `listTopScores`, `getDemandDetail`, `getRunSummary`.
- Added repository read helpers `getLatestRunId`, `listDemands`, and `listSources` for scripts to avoid direct SQL.
- Verified real Drizzle-backed run at `/tmp/demandradar-drizzle-live-cZU8r0`.

Verification:
- `npm test`
- `npm run test:e2e`
- Real run: `npm run demandradar:run -- --date 2026-06-18 --limit 3 --db /tmp/demandradar-drizzle-live-cZU8r0/demandradar.sqlite --reports-dir /tmp/demandradar-drizzle-live-cZU8r0/reports --briefs-dir /tmp/demandradar-drizzle-live-cZU8r0/briefs`
*** Add File: /home/andy/code/DemandRadar/.workflow/scratch/20260618-quick-drizzle-orm-storage/.summaries/TASK-003-summary.md
# TASK-003 Summary

Updated scripts and tests for the ORM rule.

Evidence:
- Updated `scripts/market-evidence-ab.ts` to read through `DemandRadarRepository` instead of direct SQLite queries.
- Added storage guard test that fails if `.prepare(` appears under `src` or `scripts`.
- Verified CLI read paths against a Drizzle-backed real run: `list`, `show`, and `report`.

Verification:
- `npm run typecheck`
- `npm test`
- `npm run build`
- `SMART_SEARCH_BIN=smart-search npm run smoke:live`
