CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL,
  credits_balance INTEGER NOT NULL DEFAULT 0,
  webhook_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for API key lookup
CREATE INDEX idx_agents_api_key_prefix ON agents (api_key_prefix) WHERE is_active = true;
