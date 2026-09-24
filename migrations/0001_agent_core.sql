-- Imagony's lean agent registry. Apply to the D1 database bound as DB.
-- D1 enforces foreign keys by default, including the ON DELETE CASCADE rules below.

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  operator_contact TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS registration_quota (
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 0),
  PRIMARY KEY (ip_hash, day)
);
CREATE INDEX IF NOT EXISTS idx_registration_quota_day ON registration_quota (day);

CREATE TABLE IF NOT EXISTS daily_usage (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('trace', 'handoff')),
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (agent_id, day, kind)
);
CREATE INDEX IF NOT EXISTS idx_daily_usage_day ON daily_usage (day);

CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  request_publication INTEGER NOT NULL DEFAULT 0 CHECK (request_publication IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_traces_agent_created ON traces (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_status_created ON traces (status, created_at DESC);

CREATE TABLE IF NOT EXISTS handoffs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  request_summary TEXT NOT NULL,
  mandate_scope TEXT NOT NULL,
  operator_contact TEXT NOT NULL,
  operator_authorized INTEGER NOT NULL CHECK (operator_authorized = 1),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'closed')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_handoffs_agent_created ON handoffs (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_handoffs_status_created ON handoffs (status, created_at DESC);
