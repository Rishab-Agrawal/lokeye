-- Row Level Security policies for Supabase
-- These complement the server-side auth, providing defense-in-depth

-- Enable RLS on all tables
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_credit_ledger ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so our Fastify server (using service_role key) has full access
-- These policies are for direct Supabase client access from mobile app

-- Workers can read/update their own profile
CREATE POLICY workers_select_own ON workers
  FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY workers_update_own ON workers
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Workers can see pending tasks
CREATE POLICY tasks_select_available ON tasks
  FOR SELECT USING (status = 'pending' OR worker_id::text = auth.uid()::text);

-- Workers can see their own task responses
CREATE POLICY responses_select_own ON task_responses
  FOR SELECT USING (worker_id::text = auth.uid()::text);

-- Workers can see their own payments
CREATE POLICY payments_select_own ON payments
  FOR SELECT USING (worker_id::text = auth.uid()::text);
