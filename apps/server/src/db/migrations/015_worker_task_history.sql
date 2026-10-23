-- Track worker task submissions so rejected tasks still appear in wallet history.
-- worker_id is cleared from tasks on rejection, so we need a separate record.

CREATE TABLE worker_task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id),
  task_id UUID NOT NULL REFERENCES tasks(id),
  outcome TEXT NOT NULL DEFAULT 'submitted', -- submitted, completed, rejected
  bounty_rupees INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_worker_task_history_worker ON worker_task_history(worker_id, created_at DESC);
CREATE UNIQUE INDEX idx_worker_task_history_unique ON worker_task_history(worker_id, task_id);
