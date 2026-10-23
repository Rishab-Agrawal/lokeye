-- Audit metadata for manual withdrawal actions from Telegram.
ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handled_by_telegram_user_id BIGINT,
  ADD COLUMN IF NOT EXISTS handled_by_telegram_username TEXT,
  ADD COLUMN IF NOT EXISTS handled_in_chat_id BIGINT,
  ADD COLUMN IF NOT EXISTS handled_via TEXT;

-- Backfill a sensible source label for existing handled rows.
UPDATE withdrawal_requests
SET handled_via = 'telegram_callback'
WHERE handled_via IS NULL
  AND status IN ('completed', 'rejected');

ALTER TABLE withdrawal_requests
  ALTER COLUMN handled_via SET DEFAULT 'telegram_callback';

CREATE INDEX IF NOT EXISTS idx_withdrawal_handled_by_user
  ON withdrawal_requests (handled_by_telegram_user_id, handled_at DESC);
