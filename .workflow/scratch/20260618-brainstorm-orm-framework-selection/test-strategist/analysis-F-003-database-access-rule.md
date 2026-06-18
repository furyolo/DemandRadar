# F-003 Database Access Rule

The project SHOULD add a guard test that searches for new direct SQL access outside approved storage modules.

The rule should fail on:
- `db.prepare(` outside allowed migration/escape hatch files;
- ad hoc `SELECT` / `INSERT` strings in commands, pipeline, agents, or reports.
