# DemandRadar

DemandRadar is a Node.js / TypeScript CLI for turning recent internet signals into source-backed product opportunity briefs.

## Install

```bash
npm install
npm run typecheck
npm test
```

## Config

Copy `config/.env.example` to a local, uncommitted env file and provide OpenAI-compatible LLM settings:

```bash
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
SMART_SEARCH_BIN=smart-search
DEMANDRADAR_DB_PATH=data/demandradar.sqlite
REPORTS_DIR=reports
BRIEFS_DIR=briefs
```

Real `.env` files, tokens, and runtime outputs are ignored by Git.

The CLI automatically loads `config/.env` on startup. Existing shell environment variables take precedence over values in the file.

## Fixture Run

The code completion path is fixture-backed and does not require live Smart Search or a real LLM key:

```bash
npm run test:e2e
```

Runtime outputs use:

- `reports/YYYY-MM-DD.md`
- `briefs/YYYY-MM-DD/*.md`

## CLI

```bash
npm run demandradar -- --help
npm run demandradar:run -- --date 2026-06-18 --fixture
npm run demandradar -- list --run <run-id>
npm run demandradar -- show <demand-id>
npm run demandradar -- report 2026-06-18
```

## Live Smoke

Live Smart Search checks are opt-in because upstream provider health can fail independently of code correctness.

```bash
RUN_LIVE_SMOKE=1 npm run smoke:live
```

If Smart Search returns an upstream HTTP 502, fixture E2E remains the required completion check.
