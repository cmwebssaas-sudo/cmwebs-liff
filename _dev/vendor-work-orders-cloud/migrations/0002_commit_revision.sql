CREATE TABLE IF NOT EXISTS vendor_work_orders_commit_guard (
  id INTEGER CONSTRAINT revision_guard_ok CHECK (id = 1)
);
INSERT INTO vendor_work_orders_meta (key, value)
VALUES ('revision', '0') ON CONFLICT(key) DO NOTHING;
