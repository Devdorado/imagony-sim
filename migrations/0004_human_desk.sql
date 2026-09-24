-- Human Desk business records are independent of the agent profile lifecycle.
-- The applicant receives a one-time hd_ token; only its SHA-256 hash is stored.

CREATE TABLE IF NOT EXISTS desk_requests (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  service_id TEXT NOT NULL CHECK (service_id IN ('signatory', 'governance', 'kyb', 'compliance', 'oversight', 'operations')),
  applicant_kind TEXT NOT NULL CHECK (applicant_kind IN ('human', 'agent')),
  operator_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  mandate_scope TEXT NOT NULL,
  request_summary TEXT NOT NULL,
  deadline TEXT,
  budget_text TEXT,
  authorized INTEGER NOT NULL CHECK (authorized = 1),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'needs_info', 'quoted', 'accepted', 'in_progress', 'completed', 'rejected', 'withdrawn')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  quote_version INTEGER NOT NULL DEFAULT 0 CHECK (quote_version >= 0),
  current_quote_id TEXT,
  accepted_quote_id TEXT,
  accepted_quote_version INTEGER,
  accepted_by TEXT,
  accepted_at TEXT,
  completion_report TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_desk_requests_status_created ON desk_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_desk_requests_agent ON desk_requests (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS desk_quotes (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES desk_requests(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  scope TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency IN ('CHF', 'EUR', 'USD')),
  payment_terms TEXT NOT NULL,
  payment_due TEXT NOT NULL CHECK (payment_due IN ('before_work', 'on_completion')),
  valid_until TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (request_id, version)
);
CREATE INDEX IF NOT EXISTS idx_desk_quotes_request ON desk_quotes (request_id, version DESC);

CREATE TABLE IF NOT EXISTS desk_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES desk_requests(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('created', 'message', 'status', 'quote', 'acceptance', 'withdrawal', 'payment', 'completion')),
  actor TEXT NOT NULL CHECK (actor IN ('requester', 'admin')),
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'internal')),
  body TEXT NOT NULL,
  quote_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (request_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_desk_events_request ON desk_events (request_id, revision ASC);

CREATE TABLE IF NOT EXISTS desk_payments (
  request_id TEXT PRIMARY KEY REFERENCES desk_requests(id) ON DELETE CASCADE,
  quote_id TEXT NOT NULL REFERENCES desk_quotes(id),
  status TEXT NOT NULL CHECK (status IN ('link_ready', 'confirmed')),
  url TEXT,
  reference TEXT NOT NULL UNIQUE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency IN ('CHF', 'EUR', 'USD')),
  received_amount_minor INTEGER,
  received_currency TEXT,
  received_at TEXT,
  updated_at TEXT NOT NULL,
  CHECK (status != 'confirmed' OR
    (received_amount_minor IS NOT NULL AND received_currency IS NOT NULL AND received_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS desk_agent_usage (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (agent_id, day)
);
CREATE INDEX IF NOT EXISTS idx_desk_agent_usage_day ON desk_agent_usage (day);

CREATE TABLE IF NOT EXISTS desk_ip_usage (
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (ip_hash, day)
);
CREATE INDEX IF NOT EXISTS idx_desk_ip_usage_day ON desk_ip_usage (day);

CREATE TABLE IF NOT EXISTS desk_message_usage (
  request_id TEXT NOT NULL REFERENCES desk_requests(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (request_id, day)
);
CREATE INDEX IF NOT EXISTS idx_desk_message_usage_day ON desk_message_usage (day);
