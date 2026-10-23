-- Audit and idempotency fields for manual credit top-ups via Telegram admin commands.
ALTER TABLE agent_credit_ledger
  ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handled_by_telegram_user_id BIGINT,
  ADD COLUMN IF NOT EXISTS handled_by_telegram_username TEXT,
  ADD COLUMN IF NOT EXISTS handled_in_chat_id BIGINT,
  ADD COLUMN IF NOT EXISTS handled_via TEXT,
  ADD COLUMN IF NOT EXISTS topup_reference TEXT;

-- Default source for future manual top-ups.
ALTER TABLE agent_credit_ledger
  ALTER COLUMN handled_via SET DEFAULT 'telegram_admin_command';

-- Prevent duplicate manual top-ups with the same reference.
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_topup_reference_unique
  ON agent_credit_ledger (topup_reference)
  WHERE topup_reference IS NOT NULL;

-- Helpful audit query path.
CREATE INDEX IF NOT EXISTS idx_credit_ledger_handled_by_user
  ON agent_credit_ledger (handled_by_telegram_user_id, handled_at DESC);
