-- 20251024_restrict_jobs_rls.sql
-- Tighten RLS on boxhero_sync_jobs to prevent authenticated users from reading admin job rows

-- Remove broad read policy for authenticated users
DROP POLICY IF EXISTS "bh_jobs_auth_read" ON public.boxhero_sync_jobs;

-- Ensure service-role has full access for all operations with explicit WITH CHECK
ALTER POLICY "bh_jobs_service_full" ON public.boxhero_sync_jobs
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
