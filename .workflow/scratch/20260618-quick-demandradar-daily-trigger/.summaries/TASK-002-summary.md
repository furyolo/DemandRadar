# TASK-002 Summary

Added project-level trigger instructions in `AGENTS.md`.

Evidence:
- Added keyword trigger list for DemandRadar daily report workflow.
- Documented live pipeline defaults: current UTC date, `--limit 10`, no fixture mode unless requested.
- Required CLI readback with `list`, `report`, and `show`.
- Restated the ORM-backed database access rule.

Verification:
- `test -f AGENTS.md`
- `sed -n '1,220p' AGENTS.md`
