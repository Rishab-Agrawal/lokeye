-- Manual withdrawal system: workers request withdrawal, owner pays via UPI manually.

CREATE TYPE withdrawal_status AS ENUM ('pending', 'completed', 'rejected');

CREATE TABLE withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id),
  amount_rupees INTEGER NOT NULL CHECK (amount_rupees >= 10),
  upi_vpa TEXT NOT NULL,
  status withdrawal_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  telegram_message_id BIGINT,
  completed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one pending withdrawal per worker (DB-enforced)
CREATE UNIQUE INDEX idx_withdrawal_one_pending
  ON withdrawal_requests (worker_id) WHERE status = 'pending';

CREATE INDEX idx_withdrawal_worker ON withdrawal_requests (worker_id, created_at DESC);

-- RLS: workers can SELECT their own rows
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY withdrawal_requests_worker_select
  ON withdrawal_requests FOR SELECT
  USING (worker_id = auth.uid());
