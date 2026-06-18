# Test Strategist Analysis

## 1. Role Mandate

Evaluate ORM choice by migration safety, regression testing, and confidence gates.

## 2. Decision Digest

### Decisions

| Feature | Decision | Constraint | Evidence |
|---|---|---|---|
| F-001 | Drizzle SHOULD be preferred because it minimizes behavioral change from current SQLite tests. | MUST keep fixture E2E and storage tests deterministic. | `tests/storage.test.ts`, `tests/e2e.fixture.test.ts` |
| F-002 | Migration MUST be covered by parity tests comparing old and ORM-backed repository behavior. | MUST verify writes, reads, transactions, foreign keys, and JSON fields. | Current encode/decode helpers at `src/storage/repositories.ts:13` |
| F-003 | New DB code MUST be tested through repository APIs, not direct ORM calls from feature tests. | MUST keep feature tests independent from ORM internals. | Current repository read APIs at `src/storage/repositories.ts:112` |

### Interfaces

| Provider | Consumer | Contract |
|---|---|---|
| ORM repository | tests | Same saved result counts and detail reads as current repository |
| migrations | CI/local verification | Fresh SQLite database can be created without manual steps |
| raw SQL escape hatch | tests | Each escape hatch has targeted coverage |

### Cross-Cutting Positions

| Area | Position |
|---|---|
| Regression scope | Storage, pipeline fixture E2E, CLI list/show/report tests MUST pass before replacing direct SQL. |
| Migration confidence | A migration command SHOULD be added to test fresh DB creation. |
| ORM rule enforcement | Static search SHOULD reject new `db.prepare` outside allowed storage escape-hatch files. |

### Findings Summary

| Finding | Severity | Evidence |
|---|---|---|
| Existing tests provide a good migration safety net but need ORM-specific parity additions. | High | `tests/storage.test.ts`, `tests/pipeline.test.ts` |
| JSON text serialization is the highest regression risk. | Medium | `src/storage/repositories.ts:13` |

## 3. Cross-Cutting Foundations

### Test Gates

Implementation MUST pass:

- `npm run typecheck`
- `npm test`
- `npm run test:e2e`
- targeted ORM migration/storage tests

### Risk Areas

The tests MUST explicitly cover:

- JSON columns round-trip;
- transaction rollback semantics;
- foreign key constraints;
- score ordering;
- report artifact persistence.

## 4. File Index

| File | Purpose |
|---|---|
| `analysis-F-001-orm-selection.md` | Test view of ORM selection |
| `analysis-F-002-migration-strategy.md` | Migration test strategy |
| `analysis-F-003-database-access-rule.md` | Enforcement tests |

## 5. Outstanding TODOs

- Add a static guard test or lint-like test after ORM migration begins.
