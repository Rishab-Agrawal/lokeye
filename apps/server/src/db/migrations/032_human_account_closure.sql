ALTER TABLE humans
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

CREATE TABLE IF NOT EXISTS human_account_retention (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  human_id UUID NOT NULL UNIQUE REFERENCES humans(id),
  retained_display_name TEXT,
  retained_phone TEXT NOT NULL,
  retained_upi_vpa TEXT,
  retention_reason TEXT NOT NULL DEFAULT 'user_requested_account_closure',
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retention_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_human_account_retention_deleted_at
  ON human_account_retention (deleted_at DESC);

ALTER TABLE human_account_retention ENABLE ROW LEVEL SECURITY;
