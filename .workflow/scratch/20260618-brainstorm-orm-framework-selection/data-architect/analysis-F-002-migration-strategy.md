# F-002 Migration Strategy

The migration SHOULD be incremental.

Steps:
1. Add Drizzle schema definitions equivalent to `src/storage/schema.ts`.
2. Add migration tooling.
3. Keep `DemandRadarRepository` as the application-facing API.
4. Replace one repository method at a time.
5. Run fixture E2E and storage tests after each step.

This avoids changing pipeline logic while replacing database internals.
