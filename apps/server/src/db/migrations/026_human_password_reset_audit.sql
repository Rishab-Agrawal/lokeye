-- Audit trail for admin-triggered human password resets from Telegram.
CREATE TABLE IF NOT EXISTS human_password_reset_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  human_id UUID NOT NULL REFERENCES humans(id),
  reset_by_telegram_user_id BIGINT,
  reset_by_telegram_username TEXT,
  reset_in_chat_id BIGINT,
  reset_via TEXT NOT NULL DEFAULT 'telegram_admin_command',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_audit_human
  ON human_password_reset_audit (human_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_audit_actor
  ON human_password_reset_audit (reset_by_telegram_user_id, created_at DESC);
