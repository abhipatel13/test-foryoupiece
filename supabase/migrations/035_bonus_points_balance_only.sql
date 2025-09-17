-- 035_bonus_points_balance_only.sql
-- Adds a function that credits bonus points to spendable balance ONLY (does not affect total_points_earned)

CREATE OR REPLACE FUNCTION award_bonus_points_balance_only(
  p_user_id UUID,
  p_points INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  cur_balance INTEGER;
  new_balance INTEGER;
BEGIN
  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'Bonus points must be positive. Got: %', p_points;
  END IF;

  SELECT points_balance INTO cur_balance FROM users WHERE id = p_user_id;
  IF cur_balance IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  new_balance := cur_balance + p_points;

  UPDATE users
  SET points_balance = new_balance,
      updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update points_balance for user: %', p_user_id;
  END IF;

  RAISE NOTICE 'Awarded bonus points to user %: balance % -> % (+%)', p_user_id, cur_balance, new_balance, p_points;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION award_bonus_points_balance_only(UUID, INTEGER) TO authenticated;

