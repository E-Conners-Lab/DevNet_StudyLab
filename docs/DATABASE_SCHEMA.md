# Progress storage replaces the former database

The final local edition does not use PostgreSQL, Drizzle, learner accounts, or database migrations. The old database schema is historical and is not an installation prerequisite.

Progress uses a versioned, validated browser store with JSON export/import. See [API_REFERENCE.md](API_REFERENCE.md#progress-backup-contract), [ARCHITECTURE.md](ARCHITECTURE.md), and `apps/web/src/lib/local/schema.ts` for the current contract.

Only the old browser flashcard store is migrated automatically. No conversion of previous PostgreSQL records is provided. Preserve a backup of an earlier database before retiring that installation; do not delete its volumes merely to try this edition.
