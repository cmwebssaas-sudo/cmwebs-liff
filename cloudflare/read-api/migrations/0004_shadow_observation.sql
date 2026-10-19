CREATE TABLE shadow_attempts (
  attempt_id TEXT PRIMARY KEY, scope_hash TEXT NOT NULL, actor_hash TEXT NOT NULL,
  epoch TEXT NOT NULL, release_id TEXT NOT NULL, route TEXT NOT NULL,
  variant TEXT NOT NULL, outcome TEXT NOT NULL, status INTEGER,
  observed_at TEXT NOT NULL, report_id TEXT
);
CREATE TABLE shadow_reports (
  report_id TEXT PRIMARY KEY, scope_hash TEXT NOT NULL, actor_hash TEXT NOT NULL,
  epoch TEXT NOT NULL, release_id TEXT NOT NULL, route TEXT NOT NULL,
  variant TEXT NOT NULL, outcome TEXT NOT NULL, headers_ms REAL, elapsed_ms REAL,
  field_count INTEGER NOT NULL, observed_at TEXT NOT NULL,
  attempt_id TEXT UNIQUE REFERENCES shadow_attempts(attempt_id),
  clock_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE shadow_clock_diffs (
  report_id TEXT PRIMARY KEY, observation_id TEXT NOT NULL REFERENCES shadow_reports(report_id),
  route TEXT NOT NULL, variant TEXT NOT NULL, field_path TEXT NOT NULL, observed_at TEXT NOT NULL
);
CREATE INDEX shadow_clock_diffs_observation ON shadow_clock_diffs(observation_id);
ALTER TABLE shadow_diffs ADD COLUMN observation_id TEXT REFERENCES shadow_reports(report_id);
CREATE INDEX shadow_reports_window ON shadow_reports(scope_hash,epoch,release_id,observed_at);
CREATE INDEX shadow_reports_rate ON shadow_reports(actor_hash,observed_at);
CREATE INDEX shadow_diffs_observation ON shadow_diffs(observation_id);
CREATE INDEX shadow_attempts_window ON shadow_attempts(scope_hash,epoch,release_id,observed_at);
