# F-002 Migration Strategy

Migration MUST be storage-local.

The public API of `DemandRadarRepository` SHOULD remain stable while internal SQL calls move to Drizzle.

Recommended order:
1. Schema and migrations.
2. Insert/write transaction path.
3. Read/query path.
4. Delete old string schema once parity is proven.
