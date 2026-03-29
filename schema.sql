-- schema.sql  (run with: wrangler d1 execute cafe-sync-db --file=schema.sql)

CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_active INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_rooms_last_active ON rooms(last_active);
