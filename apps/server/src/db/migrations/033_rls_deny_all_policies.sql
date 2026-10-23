-- Explicit deny-all policies for server-only tables (silences Supabase linter)
-- Service role bypasses RLS, so these tables remain accessible to the server.

CREATE POLICY "No client access" ON public.human_account_retention FOR ALL USING (false);
CREATE POLICY "No client access" ON public.interest_signups FOR ALL USING (false);
