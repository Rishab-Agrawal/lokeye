-- Rename workers table to humans
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workers'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'humans'
  ) THEN
    ALTER TABLE workers RENAME TO humans;
  END IF;
END $$;

-- Rename worker_id columns across all tables
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'worker_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'human_id'
  ) THEN
    ALTER TABLE tasks RENAME COLUMN worker_id TO human_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'task_responses' AND column_name = 'worker_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'task_responses' AND column_name = 'human_id'
  ) THEN
    ALTER TABLE task_responses RENAME COLUMN worker_id TO human_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'worker_task_history'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'human_task_history'
  ) THEN
    ALTER TABLE worker_task_history RENAME TO human_task_history;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'human_task_history' AND column_name = 'worker_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'human_task_history' AND column_name = 'human_id'
  ) THEN
    ALTER TABLE human_task_history RENAME COLUMN worker_id TO human_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'withdrawal_requests' AND column_name = 'worker_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'withdrawal_requests' AND column_name = 'human_id'
  ) THEN
    ALTER TABLE withdrawal_requests RENAME COLUMN worker_id TO human_id;
  END IF;
END $$;

-- Rename indexes (Postgres keeps old names after table rename)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'idx_workers_location'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'idx_humans_location'
  ) THEN
    ALTER INDEX idx_workers_location RENAME TO idx_humans_location;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'idx_workers_active_location'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'idx_humans_active_location'
  ) THEN
    ALTER INDEX idx_workers_active_location RENAME TO idx_humans_active_location;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'idx_workers_phone'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = 'idx_humans_phone'
  ) THEN
    ALTER INDEX idx_workers_phone RENAME TO idx_humans_phone;
  END IF;
END $$;

-- Rename column references in humans table (display columns stay the same)
-- No column renames needed in humans table itself (id, phone, display_name, etc. are fine)

-- Update the partial unique index on withdrawal_requests
-- (references worker_id which is now human_id)
DROP INDEX IF EXISTS idx_withdrawal_one_pending_per_worker;
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_one_pending_per_human ON withdrawal_requests (human_id) WHERE status = 'pending';
