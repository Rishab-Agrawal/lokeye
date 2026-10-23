-- Enable RLS on tables missing it (flagged as critical by Supabase)

-- _migrations: internal tracking table, no client access needed
ALTER TABLE _migrations ENABLE ROW LEVEL SECURITY;

-- worker_task_history: workers can read their own history
ALTER TABLE worker_task_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY worker_task_history_select_own ON worker_task_history
  FOR SELECT USING (worker_id::text = auth.uid()::text);
