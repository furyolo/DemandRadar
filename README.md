# DemandRadar

DemandRadar is a Node.js / TypeScript CLI for turning recent internet signals into source-backed product opportunity briefs. Its product direction is evolving from demand discovery into opportunity discovery: identify paid tasks, judge whether the creator plus AI Agents can deliver them, and surface when external supply can help close a deal.

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

## Opportunity Positioning

DemandRadar treats demand signals as candidate business opportunities only after they pass deliverability and deal-fit checks:

- `upwork` and `fiverr` are paid-demand channels: buyer jobs, requests, budgets, required skills, urgency, and visible supply response are first-class evidence.
- `goofish`, `reddit`, `github`, and similar channels can provide supply, validation, reusable technology, or missing context for fulfilling a paid task.
- Reports should distinguish raw demand from actionable opportunities: whether the creator can deliver alone, with AI Agents, or only through third-party supply.
- Default collection remains read-only. Applying to jobs, sending messages, ordering services, or changing platform state requires explicit human confirmation.

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

Upwork jobs and Fiverr marketplace records can also enter through provider-neutral JSON imports:

```bash
npm run demandradar:run -- --upwork-json data/upwork-jobs.json --upwork-query "AI automation jobs" --skip-smart-search --locale zh-CN
npm run demandradar:run -- --fiverr-json data/fiverr-gigs.json --fiverr-query "AI chatbot supply" --skip-smart-search --locale zh-CN
```

Upwork JSON supports arrays or `{ "jobs": [...] }` / `{ "items": [...] }` / `{ "results": [...] }`, with optional `metadata`. Records should include `url`, `link`, `job_id`, or `id`; `title`; and optional `description`, `client_name`, `budget`, `hourly_rate`, `client_country`, `payment_verified`, `proposal_count`, `client_total_spent`, `skills`, and `intent`. Upwork records default to `demand` because job postings are explicit paid tasks.

If official Upwork API access is available, generate the Upwork JSON import with the read-only GraphQL adapter:

```bash
npm run upwork:import -- --query "AI automation" --limit 20 --output .tmp/upwork/jobs.json
npm run demandradar:run -- --upwork-json .tmp/upwork/jobs.json --upwork-query "AI automation" --skip-smart-search --locale zh-CN
```

The adapter reads `config/.env` and uses either `UPWORK_ACCESS_TOKEN`, or `UPWORK_API_KEY`, `UPWORK_API_SECRET`, and the token JSON at `UPWORK_TOKEN_FILE` (`UPWORK_REFRESH_TOKEN` is still accepted as a manual override). The default endpoint is `https://api.upwork.com/graphql`, and the query uses Upwork's marketplace job postings GraphQL search in read-only mode. For advanced official filters, pass `--filter-json` or `--filter-file`:

```bash
npm run upwork:import -- --query "AI automation" --filter-json "{\"searchExpression_eq\":\"AI automation\",\"daysPosted_eq\":1}" --output .tmp/upwork/jobs.json
```

To get the first token file, set `UPWORK_API_KEY`, `UPWORK_API_SECRET`, `UPWORK_REDIRECT_URI`, and `UPWORK_TOKEN_FILE` in `config/.env`. `UPWORK_REDIRECT_URI` must exactly match the callback URL configured in the Upwork API app. For the default local callback, set the Upwork API app callback URL to `http://localhost:8787/upwork/callback`, then run:

```bash
npm run upwork:auth
```

Open the printed URL and authorize in Upwork. The script listens on localhost, receives the callback, exchanges the code, and writes the token response to `UPWORK_TOKEN_FILE` such as `.tmp/upwork-token.json`. `npm run upwork:import` can refresh from that token file directly; do not commit token files.

If the callback URL is not local, `npm run upwork:auth` prints an authorization URL and exits. In that mode, copy the callback URL's `code` query parameter manually and run `npm run upwork:auth -- --code "<code-from-callback>"`.

Fiverr JSON supports arrays or `{ "gigs": [...] }` / `{ "items": [...] }` / `{ "results": [...] }`, with optional `metadata`. Records should include `url`, `gig_url`, `seller_url`, `gig_id`, or `id`; `title`; and optional `description`, `seller_name`, `price`, `min_price`, `max_price`, `budget`, `rating`, `reviews_count`, `orders_in_queue`, `seller_level`, `category`, `tags`, `record_type`, and `intent`. Fiverr gigs default to `supply`; `record_type: "brief"` or `"buyer_request"` is treated as demand.

如果本机可用 `uvx`，可以通过社区只读 MCP server 生成 Fiverr JSON 导入文件：

```bash
npm run fiverr:import -- --query "AI chatbot" --limit 20 --output .tmp/fiverr/gigs.json
npm run demandradar:run -- --fiverr-json .tmp/fiverr/gigs.json --fiverr-query "AI chatbot" --skip-smart-search --locale zh-CN
```

也可以用批量关键词文件采样市场信号。输出会包含规范化的 `gigs` 和查询级 `searches` 摘要，例如 `total_results`、样本数量、最高评论数和卖家等级分布：

```bash
npm run fiverr:import -- --queries-file config/fiverr-keywords.example.json --limit 20 --sort-by best_selling --output .tmp/fiverr/market-sample.json
```

适配器会启动 `uvx fiverr-mcp-server`，调用 MCP `search_gigs` 工具，并写出规范化 JSON。可选过滤参数包括 `--category`、`--min-price`、`--max-price`、`--seller-level` 和 `--sort-by`。这条路径保持只读；下单、联系卖家或账号操作不属于默认采集边界。

For local `goofish-cli` setup, prefer `uv tool install goofish-cli`, install Playwright Chrome when prompted, and use QR login:

```bash
goofish auth login --qr --qr-timeout 180 --format json
goofish auth status --format json
```

See `docs/channel-sources.md` for the full Goofish installation, browser, and login troubleshooting notes.

For the Goofish supply to Fiverr Gig draft workflow, including the separate local bridge command `npm run goofish:fiverr-bridge -- --port 3233 --token demandradar-local` and the Tampermonkey fill panel, see `docs/goofish-to-fiverr-upload.md`.

Before adding a new channel collector, first search for existing skills, CLI tools, MCP servers, and GitHub projects that already cover that platform. Prefer adapting their exported JSON or MCP/CLI output into DemandRadar's channel import format before writing a new crawler.

## Live Smoke

Live Smart Search checks are opt-in because upstream provider health can fail independently of code correctness.

```bash
RUN_LIVE_SMOKE=1 npm run smoke:live
```

If Smart Search returns an upstream HTTP 502, fixture E2E remains the required completion check.
