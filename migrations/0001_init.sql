CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  mobile TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  rejected_at TEXT,
  reject_reason TEXT,
  consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_registrations_mobile ON registrations(mobile);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_expires ON registrations(expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  registration_id TEXT,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_registration ON audit_log(registration_id);
