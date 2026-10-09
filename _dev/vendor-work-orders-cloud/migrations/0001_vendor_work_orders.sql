CREATE TABLE IF NOT EXISTS vendor_work_orders_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vendor_work_orders_rows (
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  workspace_id TEXT,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (table_name, row_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_work_orders_rows_workspace
  ON vendor_work_orders_rows (workspace_id, table_name);

INSERT INTO vendor_work_orders_meta (key, value)
VALUES ('schema_version', '1')
ON CONFLICT(key) DO NOTHING;

CREATE TABLE IF NOT EXISTS vendor_work_orders_auth (
  key_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vendor_work_orders_auth_kind
  ON vendor_work_orders_auth (kind, expires_at);
