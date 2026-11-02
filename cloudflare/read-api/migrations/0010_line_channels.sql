-- One LINE channel record per Workspace for V3 landlord-owned Official Accounts.
-- encrypted_secrets holds AES-GCM ciphertext; only the Worker can decrypt it.
CREATE TABLE line_channels (
  workspace_id TEXT PRIMARY KEY,
  line_login_channel_id TEXT NOT NULL UNIQUE,
  liff_id TEXT NOT NULL UNIQUE,
  messaging_channel_id TEXT NOT NULL UNIQUE,
  webhook_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('draft','verifying','active','suspended','revoked')),
  encrypted_secrets TEXT,
  verified_at TEXT,
  updated_at TEXT NOT NULL
);
