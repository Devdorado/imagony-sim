-- The named operator of an agent listing is self-reported, not verified.
-- Keep this separate from 0002 because the preview database already applied it.
ALTER TABLE marketplace_listings ADD COLUMN operator_name TEXT;
ALTER TABLE marketplace_listings ADD COLUMN authorized INTEGER NOT NULL DEFAULT 0 CHECK (authorized IN (0, 1));
