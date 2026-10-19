-- Records the schema version this D1 database was created from, so the source
-- (Node + better-sqlite3) and target (D1) histories can be reconciled.
--
-- Version 8 is the final state of app/server/src/db.ts on the source side.
-- The eight historical SQLite migrations rebuilt tables in place; they are NOT
-- replayed here because 0001_initial_schema.sql already expresses their final
-- shape. This row exists purely so a migration-verification report can confirm
-- both sides agree.
INSERT OR IGNORE INTO schema_migrations (version, applied_at)
VALUES (8, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
