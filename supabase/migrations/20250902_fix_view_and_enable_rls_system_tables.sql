-- Migration: Fix SECURITY DEFINER view and enable RLS on system tables
-- Safe/idempotent migration; it checks for existing policies before creating
-- Context: ForYouPiece e-commerce – secure admin/system tables and views

-- 1) Ensure the active_promotional_events view runs with SECURITY INVOKER semantics
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_views v
    WHERE v.schemaname = 'public' AND v.viewname = 'active_promotional_events'
  ) THEN
    -- PostgreSQL 15+: set security_invoker so underlying table RLS applies to the querying user
    EXECUTE 'ALTER VIEW public.active_promotional_events SET (security_invoker = true)';
  END IF;
END$$;

-- 2) Enable RLS on system tables (safe to run multiple times)
ALTER TABLE IF EXISTS public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.capi_event_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.capi_event_logs ENABLE ROW LEVEL SECURITY;

-- 3) Policies: email_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_logs' AND policyname = 'service_role_manage_email_logs'
  ) THEN
    EXECUTE $$
      CREATE POLICY service_role_manage_email_logs ON public.email_logs
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role')
    $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_logs' AND policyname = 'authenticated_read_own_email_logs'
  ) THEN
    EXECUTE $$
      CREATE POLICY authenticated_read_own_email_logs ON public.email_logs
      FOR SELECT TO authenticated
      USING (auth.email() = recipient)
    $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_logs' AND policyname = 'admin_read_all_email_logs'
  ) THEN
    EXECUTE $$
      CREATE POLICY admin_read_all_email_logs ON public.email_logs
      FOR SELECT TO authenticated
      USING (is_admin(auth.uid()))
    $$;
  END IF;
END$$;

-- 4) Policies: email_outbox
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_outbox' AND policyname = 'service_role_manage_email_outbox'
  ) THEN
    EXECUTE $$
      CREATE POLICY service_role_manage_email_outbox ON public.email_outbox
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role')
    $$;
  END IF;

  -- Allow authenticated users to view their own outbox rows (and admins to view all)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_outbox' AND policyname = 'authenticated_read_own_email_outbox'
  ) THEN
    EXECUTE $$
      CREATE POLICY authenticated_read_own_email_outbox ON public.email_outbox
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = email_outbox.order_id
            AND (o.user_id = auth.uid() OR is_admin(auth.uid()))
        )
      )
    $$;
  END IF;

  -- Allow authenticated users to INSERT rows tied to their own orders (via RPC enqueue_email_message)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_outbox' AND policyname = 'authenticated_insert_own_email_outbox'
  ) THEN
    EXECUTE $$
      CREATE POLICY authenticated_insert_own_email_outbox ON public.email_outbox
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = email_outbox.order_id
            AND (o.user_id = auth.uid() OR is_admin(auth.uid()))
        )
      )
    $$;
  END IF;
END$$;

-- 5) Policies: capi_event_queue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'capi_event_queue' AND policyname = 'service_role_manage_capi_event_queue'
  ) THEN
    EXECUTE $$
      CREATE POLICY service_role_manage_capi_event_queue ON public.capi_event_queue
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role')
    $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'capi_event_queue' AND policyname = 'admin_read_capi_event_queue'
  ) THEN
    EXECUTE $$
      CREATE POLICY admin_read_capi_event_queue ON public.capi_event_queue
      FOR SELECT TO authenticated
      USING (is_admin(auth.uid()))
    $$;
  END IF;
END$$;

-- 6) Policies: capi_event_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'capi_event_logs' AND policyname = 'service_role_manage_capi_event_logs'
  ) THEN
    EXECUTE $$
      CREATE POLICY service_role_manage_capi_event_logs ON public.capi_event_logs
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role')
    $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'capi_event_logs' AND policyname = 'admin_read_capi_event_logs'
  ) THEN
    EXECUTE $$
      CREATE POLICY admin_read_capi_event_logs ON public.capi_event_logs
      FOR SELECT TO authenticated
      USING (is_admin(auth.uid()))
    $$;
  END IF;
END$$;

-- Notes:
-- - These policies preserve existing behavior: service_role (server/edge) retains full access; admins can read; users can only see their own relevant data
-- - Grants are left intact; RLS policies govern actual row access
-- - View security_invoker ensures RLS on promotional_events applies when the view is queried

