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
