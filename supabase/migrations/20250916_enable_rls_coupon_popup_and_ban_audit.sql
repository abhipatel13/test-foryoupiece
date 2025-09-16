-- 20250916_enable_rls_coupon_popup_and_ban_audit.sql
-- Purpose: Enable Row Level Security (RLS) and add safe policies for
--          public.user_ban_audit and public.coupon_popup_views.
-- Notes:
-- - Policies mirror current access patterns: service role manages, admins read audit,
--   and authenticated users may read/insert their own coupon popup views.
-- - Service role JWT bypasses RLS in Supabase, but explicit policies are provided
--   for clarity and compatibility with non-bypass environments.

-- 1) Enable RLS on public.user_ban_audit
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'user_ban_audit'
  ) THEN
    RAISE NOTICE 'Table public.user_ban_audit does not exist yet; skipping.';
  ELSE
    EXECUTE 'ALTER TABLE public.user_ban_audit ENABLE ROW LEVEL SECURITY';
  END IF;
END$$;

-- Policies for user_ban_audit
DO $$
BEGIN
  -- Service role: full management access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_ban_audit' AND policyname = 'service_role_manage_user_ban_audit'
  ) THEN
    EXECUTE $$
      CREATE POLICY service_role_manage_user_ban_audit ON public.user_ban_audit
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role')
    $$;
  END IF;

  -- Admins: read audit entries (no write)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_ban_audit' AND policyname = 'admin_read_user_ban_audit'
  ) THEN
    EXECUTE $$
      CREATE POLICY admin_read_user_ban_audit ON public.user_ban_audit
      FOR SELECT TO authenticated
      USING (is_admin(auth.uid()))
    $$;
  END IF;
END$$;

COMMENT ON POLICY service_role_manage_user_ban_audit ON public.user_ban_audit IS 'Service role can fully manage ban audit entries';
COMMENT ON POLICY admin_read_user_ban_audit ON public.user_ban_audit IS 'Admins can read ban audit entries (no write)';


-- 2) Enable RLS on public.coupon_popup_views
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'coupon_popup_views'
  ) THEN
    RAISE NOTICE 'Table public.coupon_popup_views does not exist yet; skipping.';
  ELSE
    EXECUTE 'ALTER TABLE public.coupon_popup_views ENABLE ROW LEVEL SECURITY';
  END IF;
END$$;

-- Policies for coupon_popup_views
DO $$
BEGIN
  -- Service role: full management access (used by server APIs)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coupon_popup_views' AND policyname = 'service_role_manage_coupon_popup_views'
  ) THEN
    EXECUTE $$
      CREATE POLICY service_role_manage_coupon_popup_views ON public.coupon_popup_views
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role')
    $$;
  END IF;

  -- Authenticated users: may see their own seen-records
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coupon_popup_views' AND policyname = 'authenticated_read_own_coupon_popup_views'
  ) THEN
    EXECUTE $$
      CREATE POLICY authenticated_read_own_coupon_popup_views ON public.coupon_popup_views
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id)
    $$;
  END IF;

  -- Authenticated users: may insert a seen-record only for themselves
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coupon_popup_views' AND policyname = 'authenticated_insert_own_coupon_popup_views'
  ) THEN
    EXECUTE $$
      CREATE POLICY authenticated_insert_own_coupon_popup_views ON public.coupon_popup_views
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id)
    $$;
  END IF;
END$$;

COMMENT ON POLICY service_role_manage_coupon_popup_views ON public.coupon_popup_views IS 'Service role can fully manage coupon popup view records';
COMMENT ON POLICY authenticated_read_own_coupon_popup_views ON public.coupon_popup_views IS 'Authenticated users can read their own seen records';
COMMENT ON POLICY authenticated_insert_own_coupon_popup_views ON public.coupon_popup_views IS 'Authenticated users can insert seen records for themselves';

-- End of migration

