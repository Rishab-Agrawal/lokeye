CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  worker_id UUID REFERENCES workers(id),
  type task_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  instructions TEXT,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  radius_meters INTEGER NOT NULL,
  bounty_rupees INTEGER NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index for task location queries
CREATE INDEX idx_tasks_location ON tasks USING GIST (location);

-- Index for agent's tasks
CREATE INDEX idx_tasks_agent_status ON tasks (agent_id, status);

-- Index for pending tasks (for nearby queries)
CREATE INDEX idx_tasks_pending ON tasks (status, deadline) WHERE status = 'pending';

-- Index for assigned/in_progress tasks (for expiry checks)
CREATE INDEX idx_tasks_active ON tasks (status, deadline)
  WHERE status IN ('pending', 'assigned', 'in_progress');

-- Index for worker's current task
CREATE INDEX idx_tasks_worker ON tasks (worker_id) WHERE worker_id IS NOT NULL;

-- Add foreign key from workers.current_task_id to tasks
ALTER TABLE workers ADD CONSTRAINT fk_workers_current_task
  FOREIGN KEY (current_task_id) REFERENCES tasks(id) ON DELETE SET NULL;
