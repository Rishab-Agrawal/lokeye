-- Fix Supabase linter warnings

-- 1. Add deny-all policies for tables that should only be accessed via service role
--    (RLS enabled but no policies = blocked, but explicit deny is cleaner)

-- _migrations: internal table, no client access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = '_migrations' AND policyname = 'migrations_deny_all'
  ) THEN
    CREATE POLICY migrations_deny_all ON _migrations
      FOR ALL USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agents' AND policyname = 'agents_deny_all'
  ) THEN
    CREATE POLICY agents_deny_all ON agents
      FOR ALL USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agent_credit_ledger' AND policyname = 'agent_credit_ledger_deny_all'
  ) THEN
    CREATE POLICY agent_credit_ledger_deny_all ON agent_credit_ledger
      FOR ALL USING (false);
  END IF;
END $$;

-- 2. Fix function search path vulnerability
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. Clean up orphaned payments policy and trigger from dropped table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) THEN
    DROP POLICY IF EXISTS payments_select_own ON payments;
    DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
  END IF;
END $$;
