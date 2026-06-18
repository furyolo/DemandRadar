# Data Architect Analysis

## 1. Role Mandate

Evaluate ORM choice from schema ownership, migrations, data shape, and repository migration risk.

## 2. Decision Digest

### Decisions

| Feature | Decision | Constraint | Evidence |
|---|---|---|---|
| F-001 | Drizzle ORM SHOULD be selected. | MUST support SQLite, `better-sqlite3`, schema as TypeScript, indexes, and foreign keys. | `package.json:25`, `src/storage/schema.ts:12`, Context7 Drizzle docs |
| F-002 | Migration SHOULD preserve current repository boundary first. | MUST migrate schema and queries incrementally, not rewrite pipeline first. | `src/storage/repositories.ts:21`, `src/pipeline/runPipeline.ts` calls repository only at persistence boundary |
| F-003 | Future database operations MUST use ORM-backed repository methods. | MUST NOT add new direct `db.prepare(...)` feature code. | User requirement; current direct SQL at `src/storage/repositories.ts:24` |

### Interfaces

| Provider | Consumer | Contract |
|---|---|---|
| ORM schema module | repository | Typed tables for runs, sources, hotspots, demands, market evidence, scores, reports |
| repository | pipeline/CLI | Preserve `savePipelineResult`, `listTopScores`, `getDemandDetail`, `getRunSummary` |
| migration layer | tests | Create/drop/migrate SQLite schema deterministically |

### Cross-Cutting Positions

| Area | Position |
|---|---|
| JSON fields | SHOULD remain explicit serialized JSON fields initially, then MAY adopt typed helpers. |
| Foreign keys | MUST stay enforced. Current `PRAGMA foreign_keys = ON` behavior must survive migration. |
| Indexes | MUST preserve run and score indexes from `src/storage/schema.ts:86`. |

### Findings Summary

| Finding | Severity | Evidence |
|---|---|---|
| Drizzle has the highest migration fit because it can reuse `better-sqlite3`. | High | Context7 Drizzle docs; `src/storage/database.ts:1` |
| Prisma is not wrong, but adds too much machinery for a CLI MVP. | Medium | Context7 Prisma docs; current small dependency set in `package.json:23` |
| Kysely is viable but less aligned with “ORM” as a project-wide rule. | Medium | Context7 Kysely docs |

## 3. Cross-Cutting Foundations

### Data Model

The project has seven tables: runs, sources, hotspots, demands, market_evidence, scores, reports. Drizzle schema definitions SHOULD replace the string SQL in `src/storage/schema.ts`.

### Migration Strategy

1. Introduce Drizzle dependencies and schema definitions.
2. Keep `DemandRadarRepository` as the public boundary.
3. Replace repository SQL method by method.
4. Keep tests green after each repository conversion.

### Integrity Rules

Foreign keys and cascade behavior MUST remain equivalent to the current schema.

## 4. File Index

| File | Purpose |
|---|---|
| `analysis-F-001-orm-selection.md` | ORM selection |
| `analysis-F-002-migration-strategy.md` | Migration strategy |
| `analysis-F-003-database-access-rule.md` | ORM-only database access rule |

## 5. Outstanding TODOs

- Decide exact Drizzle migration command setup during implementation planning.
