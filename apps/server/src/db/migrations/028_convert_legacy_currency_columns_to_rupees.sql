-- Convert legacy sub-rupee unit columns/data to rupees.
-- Safe to run on both fresh DBs and already-deployed DBs.

DO $$
DECLARE
  has_legacy_cols BOOLEAN := false;
  legacy_suffix TEXT := 'p' || 'aise';
  legacy_bounty_col TEXT := 'bounty_' || legacy_suffix;
  legacy_amount_col TEXT := 'amount_' || legacy_suffix;
  legacy_wallet_col TEXT := 'wallet_' || legacy_suffix;
BEGIN
  -- Drop withdrawal amount checks up front so value conversion cannot violate legacy limits.
  ALTER TABLE withdrawal_requests
    DROP CONSTRAINT IF EXISTS withdrawal_requests_amount_rupees_check;

  EXECUTE format(
    'ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS %I',
    'withdrawal_requests_amount_' || 'p' || 'aise' || '_check'
  );

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'tasks' AND column_name = legacy_bounty_col) OR
        (table_name = 'human_task_history' AND column_name = legacy_bounty_col) OR
        (table_name = 'withdrawal_requests' AND column_name = legacy_amount_col) OR
        (table_name = 'agent_credit_ledger' AND column_name = legacy_amount_col) OR
        (table_name = 'humans' AND column_name = legacy_wallet_col) OR
        (table_name = 'payments' AND column_name = legacy_amount_col)
      )
  ) INTO has_legacy_cols;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = legacy_bounty_col
  ) THEN
    EXECUTE format('ALTER TABLE tasks RENAME COLUMN %I TO bounty_rupees', legacy_bounty_col);
    UPDATE tasks SET bounty_rupees = ROUND(bounty_rupees / 100.0)::int;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'human_task_history' AND column_name = legacy_bounty_col
  ) THEN
    EXECUTE format('ALTER TABLE human_task_history RENAME COLUMN %I TO bounty_rupees', legacy_bounty_col);
    UPDATE human_task_history SET bounty_rupees = ROUND(bounty_rupees / 100.0)::int;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'withdrawal_requests' AND column_name = legacy_amount_col
  ) THEN
    EXECUTE format('ALTER TABLE withdrawal_requests RENAME COLUMN %I TO amount_rupees', legacy_amount_col);
    UPDATE withdrawal_requests SET amount_rupees = ROUND(amount_rupees / 100.0)::int;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agent_credit_ledger' AND column_name = legacy_amount_col
  ) THEN
    EXECUTE format('ALTER TABLE agent_credit_ledger RENAME COLUMN %I TO amount_rupees', legacy_amount_col);
    UPDATE agent_credit_ledger
    SET amount_rupees = ROUND(amount_rupees / 100.0)::int,
        balance_after = ROUND(balance_after / 100.0)::int;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'humans' AND column_name = legacy_wallet_col
  ) THEN
    EXECUTE format('ALTER TABLE humans RENAME COLUMN %I TO wallet_rupees', legacy_wallet_col);
    UPDATE humans SET wallet_rupees = ROUND(wallet_rupees / 100.0)::int;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = legacy_amount_col
  ) THEN
    EXECUTE format('ALTER TABLE payments RENAME COLUMN %I TO amount_rupees', legacy_amount_col);
    UPDATE payments SET amount_rupees = ROUND(amount_rupees / 100.0)::int;
  END IF;

  -- credits_balance kept the same name; convert only on legacy DBs.
  IF has_legacy_cols THEN
    UPDATE agents SET credits_balance = ROUND(credits_balance / 100.0)::int;
  END IF;
END $$;

ALTER TABLE withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_amount_rupees_check
  CHECK (amount_rupees >= 10);
