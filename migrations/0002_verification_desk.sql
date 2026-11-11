-- Operator-only case desk, OFF by default. Stores no names, raw addresses,
-- attachments, financial details, allegations, or free-text case descriptions.
-- Records track claimed progress only; they do NOT authenticate land titles.
CREATE TABLE IF NOT EXISTS verification_cases (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('land','house','rental')),
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('lagos','fct','enugu','other')),
  professional_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_verification_cases_created
  ON verification_cases(created_at);

CREATE TABLE IF NOT EXISTS verification_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES verification_cases(id) ON DELETE CASCADE,
  check_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'requested','received_unverified','review_reported','needs_clarification'
  )),
  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN (
    'none','seller_document','legal_opinion_described','survey_report_described',
    'registry_result_described','site_visit_described','agreement_described'
  )),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_verification_events_case
  ON verification_events(case_id,created_at,id);

-- Case events cannot be edited: correcting a recorded state requires a new
-- event. Privacy-retention deletion remains explicitly permitted.
CREATE TRIGGER IF NOT EXISTS prevent_verification_event_update
BEFORE UPDATE ON verification_events
BEGIN
  SELECT RAISE(ABORT, 'verification review events are append-only');
END;
