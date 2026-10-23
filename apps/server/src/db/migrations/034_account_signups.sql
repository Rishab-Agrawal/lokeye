-- Log every account creation for audit trail
CREATE TABLE account_signups (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  upi_vpa TEXT,
  human_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by phone or UPI
CREATE INDEX idx_account_signups_phone ON account_signups (phone);
CREATE INDEX idx_account_signups_upi ON account_signups (upi_vpa) WHERE upi_vpa IS NOT NULL;

-- RLS: server-only table
ALTER TABLE account_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access" ON account_signups FOR ALL USING (false);
