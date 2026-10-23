CREATE TABLE task_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL UNIQUE REFERENCES tasks(id),
  worker_id UUID NOT NULL REFERENCES workers(id),
  text_response TEXT,
  media_urls TEXT[] DEFAULT '{}',
  capture_location GEOGRAPHY(POINT, 4326),
  capture_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_responses_task ON task_responses (task_id);
CREATE INDEX idx_task_responses_worker ON task_responses (worker_id);
