-- The one table worker.js actually uses (state blob/shards). Applied to the LOCAL D1 by `npm run dev:worker`;
-- production already has it. schema.sql is a future relational design and is not used.
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER);
