# System Architect Analysis

## 1. Role Mandate

Evaluate ORM choice against module boundaries, runtime architecture, failure modes, and CLI deployability.

## 2. Decision Digest

### Decisions

| Feature | Decision | Constraint | Evidence |
|---|---|---|---|
| F-001 | Drizzle SHOULD be adopted because it is lightweight and compatible with the existing runtime. | MUST keep local CLI startup and file-backed SQLite simple. | `package.json:9`, `src/storage/database.ts:13`, Context7 Drizzle docs |
| F-002 | ORM migration MUST be hidden behind the storage module. | Pipeline and commands SHOULD NOT learn ORM details. | `src/pipeline/runPipeline.ts` only persists through repository; `src/commands/list.ts` opens repository |
| F-003 | Database operations MUST flow through storage/repository abstractions. | Direct ORM access SHOULD be forbidden outside storage unless explicitly reviewed. | User requirement |

### Interfaces

| Provider | Consumer | Contract |
|---|---|---|
| `src/storage/db` | repository | Drizzle database instance and migration bootstrapping |
| repository | commands | list/show/report read APIs |
| repository | pipeline | save complete `PipelineResult` transactionally |

### Cross-Cutting Positions

| Area | Position |
|---|---|
| Runtime footprint | Drizzle is preferred over Prisma for minimal CLI overhead. |
| Transactions | Current `savePipelineResult` transactional semantics MUST be preserved. |
| Raw SQL | Raw SQL MAY exist only as reviewed storage-layer escape hatches. |

### Findings Summary

| Finding | Severity | Evidence |
|---|---|---|
| Current database code is already isolated enough for a safe ORM migration. | High | `DemandRadarRepository` boundary at `src/storage/repositories.ts:21` |
| Drizzle imposes less architectural churn than Prisma. | High | Current `better-sqlite3` direct connection at `src/storage/database.ts:17`; Context7 docs |

## 3. Cross-Cutting Foundations

### Data Model

The ORM schema SHOULD model all existing tables, indexes, and foreign key cascades without introducing new domain objects.

### State Machine

Migration state SHOULD follow:

1. Current direct SQL repository.
2. Drizzle schema introduced, repository still public boundary.
3. Write methods migrated.
4. Read methods migrated.
5. String SQL schema removed after equivalent migrations are validated.

### Error Handling

Migration failures MUST surface clear CLI errors. Foreign key and unique constraint failures MUST remain visible to tests.

### Observability

Pipeline logging SHOULD mention migration/version failures only at storage startup. ORM query logging is not required by default for CLI MVP.

## 4. File Index

| File | Purpose |
|---|---|
| `analysis-F-001-orm-selection.md` | Architecture selection |
| `analysis-F-002-migration-strategy.md` | Incremental migration |
| `analysis-F-003-database-access-rule.md` | Access boundary |

## 5. Outstanding TODOs

- Implementation plan should define exact module names, likely `src/storage/schema.ts` for Drizzle schema and `src/storage/database.ts` for Drizzle initialization.
