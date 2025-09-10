-- Migration: Fix new-user profile creation and welcome bonus trigger timing
-- Context: New auth users were not getting a corresponding row in public.users reliably,
-- and BEFORE INSERT triggers attempted to create child rows (point_transactions, user_ranks)
-- before the parent users row existed, causing foreign key errors and broken onboarding.

-- 1) Create a robust trigger on auth.users to ensure a matching public.users profile exists
--    immediately upon registration, eliminating app-level race conditions.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name text;
  v_last_name text;
  v_telegram_username text;
  v_email text;
BEGIN
  -- Extract common metadata when available (safe if keys are missing)
  BEGIN
    v_first_name := COALESCE((NEW.raw_user_meta_data ->> 'first_name'), NULL);
    v_last_name := COALESCE((NEW.raw_user_meta_data ->> 'last_name'), NULL);
    v_telegram_username := COALESCE((NEW.raw_user_meta_data ->> 'telegram_username'), NULL);
  EXCEPTION WHEN others THEN
    v_first_name := NULL;
    v_last_name := NULL;
    v_telegram_username := NULL;
  END;

  v_email := NEW.email;

  -- Insert minimal profile; tolerate duplicates/idempotency
  INSERT INTO public.users (id, email, first_name, last_name, telegram_username, preferred_language)
  VALUES (NEW.id, v_email, v_first_name, v_last_name, v_telegram_username, 'en')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END
$$;

-- Ensure old trigger name (if any) is removed first to avoid duplicates
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create AFTER INSERT trigger so the auth.users row exists before we create public.users
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- 2) Replace BEFORE INSERT welcome bonus with AFTER INSERT approach that updates the row
--    and inserts related records after the parent users row exists (fixes FK issues).

-- Drop prior welcome bonus triggers if present (multiple names used historically)
DROP TRIGGER IF EXISTS award_welcome_bonus_trigger ON public.users;
DROP TRIGGER IF EXISTS trigger_award_welcome_bonus ON public.users;

-- Create AFTER-INSERT compatible function
CREATE OR REPLACE FUNCTION public.award_welcome_bonus_after_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  welcome_bonus_points integer := 1000;
  calculated_tier user_tier;
  current_points integer;
  current_total integer;
BEGIN
  -- Fetch current values to decide whether to grant the welcome bonus once
  SELECT points_balance, total_points_earned
    INTO current_points, current_total
  FROM public.users
  WHERE id = NEW.id;

  IF COALESCE(current_points, 0) = 0 AND COALESCE(current_total, 0) = 0 THEN
    -- Determine tier for completeness (1000 = bronze)
    calculated_tier := CASE
      WHEN welcome_bonus_points >= 50000 THEN 'diamond'
      WHEN welcome_bonus_points >= 35000 THEN 'platinum'
      WHEN welcome_bonus_points >= 15000 THEN 'gold'
      WHEN welcome_bonus_points >= 5000 THEN 'silver'
      ELSE 'bronze'
    END;

    -- Update the just-inserted users row
    UPDATE public.users
      SET points_balance = COALESCE(points_balance, 0) + welcome_bonus_points,
          total_points_earned = COALESCE(total_points_earned, 0) + welcome_bonus_points,
          tier_level = calculated_tier,
          updated_at = NOW()
      WHERE id = NEW.id;

    -- Record the welcome bonus transaction
    INSERT INTO public.point_transactions (
      user_id, points, transaction_type, reference_type, description, created_at
    ) VALUES (
      NEW.id, welcome_bonus_points, 'bonus', 'signup', 'Welcome bonus for new user registration', NOW()
    );

    -- Create initial rank record if the table exists and record not present
    -- If user_ranks table is not present in some envs, handle gracefully
    BEGIN
      INSERT INTO public.user_ranks (user_id, rank, points_at_rank, achieved_at, is_current)
      VALUES (NEW.id, calculated_tier, welcome_bonus_points, NOW(), TRUE)
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN undefined_table THEN
      -- Older environments may not yet have user_ranks; skip silently
      PERFORM 1;
    END;
  END IF;

  RETURN NEW;
END
$$;

-- Create the AFTER INSERT trigger on public.users
CREATE TRIGGER award_welcome_bonus_after_insert
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.award_welcome_bonus_after_insert();

-- Documentation
COMMENT ON FUNCTION public.handle_new_auth_user() IS 'Ensures a minimal public.users profile exists for every new auth.users row; idempotent.';
COMMENT ON FUNCTION public.award_welcome_bonus_after_insert() IS 'Awards welcome bonus after a users row exists; updates users and inserts transactions/ranks; fixes FK errors.';

