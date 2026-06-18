# ORM Design Research

## Reference Documentation

### Drizzle ORM

Context7 result: `/drizzle-team/drizzle-orm-docs`.

Findings:
- Drizzle can initialize directly with `drizzle-orm/better-sqlite3`.
- Drizzle supports SQLite table declarations with `sqliteTable`.
- Drizzle supports indexes and unique indexes in SQLite schema declarations.
- Drizzle supports foreign key references in SQLite columns.

Applicability: high. DemandRadar already uses `better-sqlite3` and SQLite.

### Prisma

Context7 result: `/prisma/web`.

Findings:
- Prisma supports SQLite datasource setup and migrations.
- Prisma requires Prisma packages, generated client, and SQLite adapter setup.
- Prisma has raw SQL escape hatches through `$queryRaw`.

Applicability: medium-low for MVP. Strong ecosystem, but heavier than needed for a local CLI.

### Kysely

Context7 result: `/kysely-org/kysely`.

Findings:
- Kysely is a type-safe TypeScript SQL query builder.
- Kysely supports SQLite migrations and schema builder APIs.
- Kysely is well suited for complex SQL but less of an ORM schema owner.

Applicability: medium. Good fallback if preserving SQL-like query shape is the primary concern.

## Recommendation

DemandRadar SHOULD adopt Drizzle ORM first. It is the best match for:

- Node.js / TypeScript
- SQLite
- existing `better-sqlite3`
- lightweight CLI runtime
- schema as code
- typed queries without Prisma-level runtime/tooling weight
