# DemandRadar Agent Instructions

## Keyword Triggers

When the user asks any of the following, run the DemandRadar live report workflow:

- `$demandradar-daily`
- `跑需求雷达日报`
- `生成 DemandRadar 报告`
- `生成今天的需求雷达报告`
- `运行完整需求雷达流程`
- `跑真实流程并产出日报`

## DemandRadar Daily Workflow

- Use the global `demandradar-daily` skill when available.
- Work from `D:/Coding/DemandRadar`.
- Load `config/.env` through the CLI; never print secrets or `.env` contents.
- Run the real pipeline, not fixture mode, unless the user explicitly asks for fixture mode.
- Default to current UTC date and `--limit 10` unless the user specifies otherwise.
- Prefer a temporary output directory for ad hoc verification runs so runtime reports, briefs, and databases are not committed accidentally.
- Do not use semantic code search for normal report readback. Use CLI help or the ORM-backed repository readback path.
- After the run completes, get `runId` and `topDemandId` through `DemandRadarRepository.getLatestRunId()` and `DemandRadarRepository.listTopScores(runId, 10)`.
- After running, verify CLI readback:
  - `npm run demandradar -- list --run <run-id> --db <db-path>`
  - `npm run demandradar -- report <date> --reports-dir <reports-dir> --db <db-path> --locale zh-CN`
  - `npm run demandradar -- show <top-demand-id> --db <db-path>`
- Report the run id, report path, Top 3 brief paths, top opportunities, and any live provider failures.

## Database Rule

All future database work must use the ORM-backed storage/repository layer. Do not add hand-written SQL or direct `db.prepare` calls outside explicitly reviewed storage-layer escape hatches with tests.
