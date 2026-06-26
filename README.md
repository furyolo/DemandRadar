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
SUPPLY_ANALYSIS_LLM_MODEL=
SMART_SEARCH_BIN=smart-search
DEMANDRADAR_DB_PATH=data/demandradar.sqlite
REPORTS_DIR=reports
BRIEFS_DIR=briefs
```

`SUPPLY_ANALYSIS_LLM_MODEL` is optional. When set, DemandRadar uses that model for structured supply-demand fit analysis and keeps `LLM_MODEL` for extraction/research; when omitted, the analysis stage reuses `LLM_MODEL`.

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

## Channel Imports

DemandRadar can ingest RedNote/Xiaohongshu notes exported by an external skill, MCP server, or API without binding the core pipeline to a specific provider:

```bash
npm run demandradar:run -- --rednote-json data/rednote-notes.json --rednote-query "AI tools" --skip-smart-search
```

Supported JSON shapes:

```json
[
  {
    "url": "https://www.xiaohongshu.com/explore/...",
    "title": "Note title",
    "content": "Note content",
    "author": "Author name",
    "likes": 100,
    "collects": 20,
    "comments": 5,
    "tags": ["AI", "效率"]
  }
]
```

or `{ "notes": [...] }` / `{ "results": [...] }`. Imported records are mapped into `rednote` sources and hotspots before the existing demand extraction pipeline runs.

Goofish/Xianyu listings use the same channel import path:

```bash
npm run goofish:import -- --query "求购 家教" --limit 20 --output .tmp/goofish-2026-06-26/items.json
npm run demandradar:run -- --goofish-json .tmp/goofish-2026-06-26/items.json --goofish-query "求购 家教" --skip-smart-search --locale zh-CN --db .tmp/goofish-2026-06-26/demandradar.sqlite --reports-dir .tmp/goofish-2026-06-26/reports --briefs-dir .tmp/goofish-2026-06-26/briefs
```

The import script shells out to the external read-only Goofish CLI search command and writes JSON for DemandRadar. By default it runs `goofish search items <query> --limit <n> --format json`. If you use `uvx goofish-cli`, run:

```bash
npm run goofish:import -- --command uvx --command-arg goofish-cli --query "求购 家教" --output .tmp/goofish-2026-06-26/items.json
```

Supported JSON shapes are arrays or `{ "items": [...] }` / `{ "listings": [...] }` / `{ "results": [...] }`, with optional `metadata`. Goofish records should include `url` or `item_id`, `title`, and optional `description`, `seller`, `price`, `location` / `city`, `want_count`, `view_count`, `favorite_count`, `tags`, and `intent`.

For local `goofish-cli` setup, prefer `uv tool install goofish-cli`, install Playwright Chrome when prompted, and use QR login:

```bash
goofish auth login --qr --qr-timeout 180 --format json
goofish auth status --format json
```

See `docs/channel-sources.md` for the full Goofish installation, browser, and login troubleshooting notes.

Before adding a new channel collector, first search for existing skills, CLI tools, MCP servers, and GitHub projects that already cover that platform. Prefer adapting their exported JSON or MCP/CLI output into DemandRadar's channel import format before writing a new crawler.

## Live Smoke

Live Smart Search checks are opt-in because upstream provider health can fail independently of code correctness.

```bash
RUN_LIVE_SMOKE=1 npm run smoke:live
```

If Smart Search returns an upstream HTTP 502, fixture E2E remains the required completion check.
