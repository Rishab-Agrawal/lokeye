-- Store in-app support requests from humans (for rate limiting and audit).
CREATE TABLE IF NOT EXISTS human_support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  human_id UUID NOT NULL REFERENCES humans(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_human_support_requests_human_created
  ON human_support_requests (human_id, created_at DESC);
