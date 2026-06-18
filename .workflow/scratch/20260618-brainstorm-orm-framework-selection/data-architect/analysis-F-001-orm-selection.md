# F-001 ORM Selection

Drizzle ORM SHOULD be selected for DemandRadar.

Rationale:
- It directly supports `better-sqlite3`, matching the current dependency.
- It defines SQLite schema in TypeScript, matching the project's TypeScript-first design.
- It preserves SQL-like control without requiring Prisma's generated client workflow.

Kysely MAY remain a fallback for query-builder-only needs. Prisma SHOULD NOT be first choice for the MVP.
