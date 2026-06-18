# F-003 Database Access Rule

The architecture MUST enforce:

- commands and pipeline call repository methods;
- repository/storage modules use Drizzle;
- raw SQL escape hatches live only in storage modules;
- tests cover every escape hatch.

This keeps future features from scattering database logic across the application.
