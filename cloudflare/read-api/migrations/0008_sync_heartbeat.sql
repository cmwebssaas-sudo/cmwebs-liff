-- Apps Script reports the time at which no read-replica changes were pending.
-- Reads fall back to Apps Script when this report is older than 15 minutes.
CREATE TABLE sync_heartbeat (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  clean_version INTEGER NOT NULL,
  received_at TEXT NOT NULL
);
