-- Migration: Add missing update_user_points function
-- This function is critical for points refunds during order cancellation
-- and is used throughout the application for points balance updates

-- Function to safely update user points balance
CREATE OR REPLACE FUNCTION update_user_points(
    p_user_id UUID,
    p_points INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    current_balance INTEGER;
    new_balance INTEGER;
BEGIN
    -- Get current points balance
    SELECT points_balance INTO current_balance
    FROM users
    WHERE id = p_user_id;
    
    -- Check if user exists
    IF current_balance IS NULL THEN
        RAISE EXCEPTION 'User not found with ID: %', p_user_id;
    END IF;
    
    -- Calculate new balance
    new_balance := current_balance + p_points;
    
    -- Prevent negative balance (safety check)
    IF new_balance < 0 THEN
        RAISE EXCEPTION 'Operation would result in negative balance. Current: %, Change: %, Result: %', 
            current_balance, p_points, new_balance;
    END IF;
    
    -- Update user's points balance
    UPDATE users 
    SET points_balance = new_balance,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Verify the update was successful
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Failed to update user points balance for user: %', p_user_id;
    END IF;
    
    -- Log the operation for debugging
    RAISE NOTICE 'Updated user % points balance: % -> % (change: %)', 
        p_user_id, current_balance, new_balance, p_points;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION update_user_points(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_points(UUID, INTEGER) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION update_user_points(UUID, INTEGER) IS 'Safely updates user points balance by adding the specified points amount (can be negative for deductions). Includes validation to prevent negative balances and provides detailed error messages.';
