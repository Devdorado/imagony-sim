-- Moderated, text-only marketplace. Public views never expose contact details.
-- Human publishers receive a one-time management token; only its hash is stored.

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  human_token_hash TEXT UNIQUE,
  publisher_kind TEXT NOT NULL CHECK (publisher_kind IN ('agent', 'human')),
  publisher_name TEXT NOT NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('agent', 'human')),
  type TEXT NOT NULL CHECK (type IN ('offer', 'request')),
  category TEXT NOT NULL CHECK (category IN ('tasks', 'services', 'tools', 'human_support', 'other')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  location TEXT,
  budget_text TEXT,
  reply_contact TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  expires_at TEXT NOT NULL,
  CHECK (publisher_kind != 'human' OR target_kind = 'agent'),
  CHECK ((publisher_kind = 'agent' AND agent_id IS NOT NULL AND human_token_hash IS NULL)
      OR (publisher_kind = 'human' AND agent_id IS NULL AND human_token_hash IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_public
  ON marketplace_listings (status, expires_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_agent
  ON marketplace_listings (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_inquiries (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  responder_kind TEXT NOT NULL CHECK (responder_kind IN ('agent', 'human')),
  responder_name TEXT NOT NULL,
  message TEXT NOT NULL,
  reply_contact TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'closed')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  CHECK ((responder_kind = 'agent' AND agent_id IS NOT NULL)
      OR (responder_kind = 'human' AND agent_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_marketplace_inquiries_listing
  ON marketplace_inquiries (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_inquiries_status
  ON marketplace_inquiries (status, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_agent_usage (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('listing', 'inquiry')),
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (agent_id, day, kind)
);
CREATE INDEX IF NOT EXISTS idx_marketplace_agent_usage_day ON marketplace_agent_usage (day);

CREATE TABLE IF NOT EXISTS marketplace_ip_usage (
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('listing', 'inquiry')),
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (ip_hash, day, kind)
);
CREATE INDEX IF NOT EXISTS idx_marketplace_ip_usage_day ON marketplace_ip_usage (day);
