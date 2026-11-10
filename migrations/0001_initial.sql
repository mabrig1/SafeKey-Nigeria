-- Data minimized by design: do not store submitted phone numbers,
-- raw property addresses or full listing URLs in automated check history.
CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,
  property_key TEXT,
  agent_key TEXT,
  listing_key TEXT,
  risk_level TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_checks_property ON checks(property_key, created_at);
CREATE INDEX IF NOT EXISTS idx_checks_listing ON checks(listing_key, created_at);
CREATE INDEX IF NOT EXISTS idx_checks_created ON checks(created_at);

-- Reports are PRIVATE. Nothing here is published automatically.
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  area TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);

CREATE TABLE IF NOT EXISTS professionals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  profession TEXT NOT NULL,
  city TEXT NOT NULL,
  credential_label TEXT NOT NULL,
  evidence_url TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_professionals_city ON professionals(city, active);

CREATE TABLE IF NOT EXISTS rate_buckets (
  key TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY(key, bucket)
);
