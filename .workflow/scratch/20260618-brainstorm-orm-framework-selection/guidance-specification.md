# Brainstorm: ORM Framework Selection

## 1. Project Positioning & Goals

DemandRadar is a Node.js 24 / TypeScript CLI that stores structured demand intelligence in SQLite and Markdown files. The storage layer currently uses `better-sqlite3` directly, string SQL schema creation, and a hand-written repository.

Goal: choose an ORM approach that keeps the CLI small, type-safe, SQLite-first, and easy to migrate from the current repository pattern.

## 2. Concepts & Terminology

| Term | Definition | Evidence |
|---|---|---|
| SQLite local store | File-backed database used by the CLI for runs, sources, hotspots, demands, market evidence, scores, and reports. | `src/storage/schema.ts:1` |
| Repository boundary | Current class that hides SQL statements from pipeline and CLI commands. | `src/storage/repositories.ts:21` |
| JSON text columns | Arrays/objects encoded into SQLite `TEXT` columns such as `metadata`, `raw`, `source_ids`, `citations`, and `dimension_scores`. | `src/storage/repositories.ts:13` |
| ORM | TypeScript database abstraction used for schema, queries, transactions, and migrations. | User requirement |
| Raw SQL escape hatch | Controlled mechanism for rare SQL that ORM cannot express cleanly. | Prisma docs mention `$queryRaw`; Drizzle/Kysely expose SQL builders |

## 3. Non-Goals

- This brainstorm MUST NOT implement the ORM migration.
- This brainstorm MUST NOT change source code outside this session output.
- The project SHOULD NOT adopt a server database requirement for the MVP.
- The project SHOULD NOT add a heavyweight runtime if a lighter SQLite-first ORM satisfies the needs.

## 4. Architecture Decisions

| ID | Decision | Status | Rationale |
|---|---|---|---|
| ORM-001 | Future database operations MUST use an ORM/query-builder abstraction instead of hand-written repository SQL. | LOCKED | User explicitly required ORM-only future database operations. |
| ORM-002 | Drizzle ORM SHOULD be the default recommendation for DemandRadar. | RECOMMENDED | Drizzle supports `better-sqlite3`, SQLite schema declarations, indexes, foreign keys, and type-safe queries while matching the current TypeScript-first local SQLite stack. |
| ORM-003 | Kysely MAY be considered if the team wants SQL-query-builder ergonomics over ORM schema ownership. | DEFERRED | Kysely is strong for typed SQL, but migrations/schema ownership are less integrated for this project than Drizzle. |
| ORM-004 | Prisma SHOULD NOT be the first choice for this CLI MVP. | RECOMMENDED | Prisma is mature, but its generated client, schema workflow, and heavier dependency footprint are less aligned with the current small CLI + `better-sqlite3` setup. |
| ORM-005 | Raw SQL MUST be isolated behind explicit escape-hatch helpers and MUST NOT appear in feature/pipeline code. | LOCKED | Preserves user requirement while allowing exceptional optimized queries. |

## 5. Evidence Summary

- Current stack is TypeScript, Node.js 24, SQLite, and `better-sqlite3`: `package.json:9`, `package.json:23`.
- Current DB connection and migration are direct `better-sqlite3`: `src/storage/database.ts:1`, `src/storage/database.ts:8`.
- Current repository uses repeated `db.prepare(...)` SQL strings for all writes/reads: `src/storage/repositories.ts:24`, `src/storage/repositories.ts:112`.
- Current schema has foreign keys and indexes that should move to ORM-owned schema definitions: `src/storage/schema.ts:12`, `src/storage/schema.ts:86`.
- Context7 docs: Drizzle initializes directly with `drizzle-orm/better-sqlite3`, supports SQLite table schema, indexes, and foreign keys.
- Context7 docs: Prisma supports SQLite migrations and generated client, but requires Prisma packages/client and adapter setup.
- Context7 docs: Kysely supports typed SQLite migrations and query building, but it is best characterized as a type-safe SQL query builder.

## 6. ORM Candidate Comparison

| Candidate | Fit | Strengths | Risks |
|---|---:|---|---|
| Drizzle ORM | High | SQLite-first, `better-sqlite3` support, TypeScript schema, indexes/FKs, lightweight, close to SQL. | Requires writing schema definitions and deciding migration tool flow. |
| Kysely | Medium | Excellent typed SQL, low runtime abstraction, good for complex queries. | Not a full ORM; schema/codegen/migrations need more assembly. |
| Prisma | Medium-Low | Mature migrations, generated client, strong ecosystem. | Heavier runtime/tooling, less sympathetic to current `better-sqlite3` repository style and local CLI minimalism. |
| TypeORM | Low | Familiar entity ORM. | Heavier active-record/data-mapper style, less aligned with small SQLite CLI and TypeScript literal schema style. |
| MikroORM | Low | Rich ORM features. | Overpowered for this data model and MVP CLI. |

## 7. Cross-Role Integration

- Data architecture MUST own ORM schema definitions and migrations.
- System architecture MUST keep pipeline code dependent on repository interfaces, not ORM internals.
- Test strategy MUST require fixture E2E tests and migration tests before removing direct SQL.

## 8. Risks & Constraints

- JSON text fields need explicit serialization helpers or SQLite JSON mode conventions.
- Migrating all repository methods at once is risky; migration SHOULD be incremental behind the existing `DemandRadarRepository` interface.
- Direct SQL strings may still exist during migration, but new database access MUST NOT add more direct SQL.

## 10. Feature Decomposition

| ID | Feature | Description | Priority |
|---|---|---|---|
| F-001 | ORM Selection | Select and document the ORM framework for the project. | MUST |
| F-002 | Migration Strategy | Define how current schema and repository methods move to ORM without breaking CLI runs. | MUST |
| F-003 | Database Access Rule | Establish future rule that database operations go through ORM/repository abstractions. | MUST |

## 11. Appendix: Decision Tracking

| Decision | Source |
|---|---|
| Future DB operations must use ORM | User request |
| Recommend Drizzle ORM | Codebase fit + Context7 docs |
| Preserve repository boundary during migration | Current `DemandRadarRepository` structure |

## 12. Cross-Role Resolutions

No cross-role issues detected.
