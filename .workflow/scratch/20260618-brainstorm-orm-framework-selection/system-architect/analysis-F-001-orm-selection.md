# F-001 ORM Selection

Drizzle ORM SHOULD be selected.

System rationale:
- It keeps the current SQLite file model.
- It works with `better-sqlite3`.
- It does not require a generated client runtime workflow as central as Prisma.
- It preserves SQL-like predictability for a CLI pipeline.
