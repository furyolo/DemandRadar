# F-003 Database Access Rule

All future database operations MUST use ORM-backed repository methods.

Allowed:
- Drizzle query APIs inside storage modules.
- Explicit repository methods used by commands and pipeline.
- Narrow raw SQL helpers only when documented and covered by tests.

Disallowed:
- New `db.prepare(...)` calls in commands, pipeline, agents, or feature modules.
- Ad hoc SQL strings outside the storage layer.
