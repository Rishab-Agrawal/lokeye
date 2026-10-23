-- Enable RLS for audit/support tables and add explicit deny-all policies.
-- These tables are written/read only by server-side code (service role), not by client JWTs.

ALTER TABLE human_password_reset_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_support_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'human_password_reset_audit'
      AND policyname = 'human_password_reset_audit_deny_all'
  ) THEN
    CREATE POLICY human_password_reset_audit_deny_all
      ON human_password_reset_audit
      FOR ALL
      USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'human_support_requests'
      AND policyname = 'human_support_requests_deny_all'
  ) THEN
    CREATE POLICY human_support_requests_deny_all
      ON human_support_requests
      FOR ALL
      USING (false);
  END IF;
END $$;
