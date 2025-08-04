-- Function to redeem user points during checkout
CREATE OR REPLACE FUNCTION redeem_user_points(
    p_user_id UUID,
    p_points INTEGER,
    p_description TEXT DEFAULT 'Points redeemed',
    p_reference_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_balance INTEGER;
BEGIN
    -- Get current points balance
    SELECT points_balance INTO current_balance
    FROM users
    WHERE id = p_user_id;
    
    -- Check if user exists
    IF current_balance IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Check if user has enough points
    IF current_balance < p_points THEN
        RAISE EXCEPTION 'Insufficient points balance. Current: %, Required: %', current_balance, p_points;
    END IF;
    
    -- Deduct points from user balance
    UPDATE users 
    SET points_balance = points_balance - p_points,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Record the redemption transaction
    INSERT INTO point_transactions (
        user_id,
        points,
        transaction_type,
        reference_type,
        reference_id,
        description,
        created_at
    ) VALUES (
        p_user_id,
        -p_points, -- Negative for redemption
        'redeemed',
        'order',
        p_reference_id,
        p_description,
        NOW()
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION redeem_user_points(UUID, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_user_points(UUID, INTEGER, TEXT, TEXT) TO service_role;
