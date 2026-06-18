# F-001 ORM Selection

Drizzle SHOULD be selected because it allows the smallest behavioral testing delta from current `better-sqlite3` storage.

Prisma would require more generated-client specific tests. Kysely would require more hand-owned type and migration conventions.
