-- Server-verified login channel for accelerated shadow coverage.
-- Historical attempts remain unknown and cannot satisfy channel coverage.
ALTER TABLE shadow_attempts ADD COLUMN auth_kind TEXT NOT NULL DEFAULT 'unknown'
  CHECK (auth_kind IN ('unknown','line','email'));
