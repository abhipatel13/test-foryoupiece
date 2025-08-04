-- Database Functions and Triggers
-- ForYouPiece E-commerce Platform

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_verifications_updated_at BEFORE UPDATE ON payment_verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate user tier based on total spent
CREATE OR REPLACE FUNCTION calculate_user_tier(total_spent DECIMAL)
RETURNS user_tier AS $$
BEGIN
    IF total_spent >= 500000 THEN -- 500,000 JPY
        RETURN 'platinum';
    ELSIF total_spent >= 200000 THEN -- 200,000 JPY
        RETURN 'gold';
    ELSIF total_spent >= 50000 THEN -- 50,000 JPY
        RETURN 'silver';
    ELSE
        RETURN 'bronze';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate points earned from order
-- Fixed: Uses correct 10 points per $1 formula (1% cashback, 1000 points = $1 USD)
CREATE OR REPLACE FUNCTION calculate_points_earned(
    order_total DECIMAL,
    user_tier user_tier DEFAULT 'bronze'
)
RETURNS INTEGER AS $$
DECLARE
    base_points_per_dollar INTEGER := 10; -- 10 points per $1 (1% cashback rate)
    tier_multiplier DECIMAL;
BEGIN
    -- Set tier multiplier (currently not used, but kept for future enhancement)
    CASE user_tier
        WHEN 'bronze' THEN tier_multiplier := 1.0;
        WHEN 'silver' THEN tier_multiplier := 1.2;
        WHEN 'gold' THEN tier_multiplier := 1.5;
        WHEN 'platinum' THEN tier_multiplier := 2.0;
        ELSE tier_multiplier := 1.0;
    END CASE;

    -- Calculate points: $1 = 10 points (1% cashback, 1000 points = $1 USD)
    -- For now, using base rate without tier multiplier to match current system
    RETURN FLOOR(order_total * base_points_per_dollar);
END;
$$ LANGUAGE plpgsql;

-- Function to update user stats when order is completed
CREATE OR REPLACE FUNCTION update_user_stats_on_order_completion()
RETURNS TRIGGER AS $$
DECLARE
    points_to_add INTEGER;
    new_tier user_tier;
BEGIN
    -- Only process when payment status changes to 'verified'
    IF OLD.payment_status != 'verified' AND NEW.payment_status = 'verified' THEN
        -- Calculate points earned
        points_to_add := calculate_points_earned(NEW.total_amount, 
            (SELECT tier_level FROM users WHERE id = NEW.user_id));
        
        -- Update user stats
        UPDATE users SET
            total_spent = total_spent + NEW.total_amount,
            total_orders = total_orders + 1,
            points_balance = points_balance + points_to_add
        WHERE id = NEW.user_id;
        
        -- Calculate new tier
        SELECT calculate_user_tier(total_spent) INTO new_tier
        FROM users WHERE id = NEW.user_id;
        
        -- Update tier if changed
        UPDATE users SET tier_level = new_tier WHERE id = NEW.user_id;
        
        -- Record points transaction
        INSERT INTO point_transactions (
            user_id, points, transaction_type, reference_type, 
            reference_id, description
        ) VALUES (
            NEW.user_id, points_to_add, 'earned', 'order', 
            NEW.id, 'Points earned from order ' || NEW.order_number
        );
        
        -- Update order with points earned
        NEW.points_earned = points_to_add;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply order completion trigger
CREATE TRIGGER update_user_stats_on_order_completion
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_order_completion();

-- Function to update product stock status based on quantity
CREATE OR REPLACE FUNCTION update_product_stock_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update stock status based on quantity
    IF NEW.stock_quantity <= 0 THEN
        NEW.stock_status = 'out_of_stock';
    ELSIF NEW.stock_quantity <= NEW.low_stock_threshold THEN
        NEW.stock_status = 'low_stock';
    ELSE
        NEW.stock_status = 'in_stock';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply stock status trigger to products
CREATE TRIGGER update_product_stock_status
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_product_stock_status();

-- Function to generate unique order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    order_num TEXT;
    counter INTEGER := 1;
BEGIN
    LOOP
        order_num := 'FYP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                     LPAD(EXTRACT(EPOCH FROM NOW())::TEXT, 10, '0') || 
                     LPAD(counter::TEXT, 3, '0');
        
        -- Check if order number already exists
        IF NOT EXISTS (SELECT 1 FROM orders WHERE order_number = order_num) THEN
            EXIT;
        END IF;
        
        counter := counter + 1;
    END LOOP;
    
    RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically set order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number = generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply order number trigger
CREATE TRIGGER set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION set_order_number();

-- Function to handle inventory movements
CREATE OR REPLACE FUNCTION handle_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Update product stock quantity
    IF NEW.product_id IS NOT NULL THEN
        IF NEW.movement_type = 'in' THEN
            UPDATE products SET stock_quantity = stock_quantity + NEW.quantity
            WHERE id = NEW.product_id;
        ELSIF NEW.movement_type = 'out' THEN
            UPDATE products SET stock_quantity = stock_quantity - NEW.quantity
            WHERE id = NEW.product_id;
        ELSIF NEW.movement_type = 'adjustment' THEN
            UPDATE products SET stock_quantity = NEW.quantity
            WHERE id = NEW.product_id;
        END IF;
    END IF;
    
    -- Update variant stock quantity
    IF NEW.variant_id IS NOT NULL THEN
        IF NEW.movement_type = 'in' THEN
            UPDATE product_variants SET stock_quantity = stock_quantity + NEW.quantity
            WHERE id = NEW.variant_id;
        ELSIF NEW.movement_type = 'out' THEN
            UPDATE product_variants SET stock_quantity = stock_quantity - NEW.quantity
            WHERE id = NEW.variant_id;
        ELSIF NEW.movement_type = 'adjustment' THEN
            UPDATE product_variants SET stock_quantity = NEW.quantity
            WHERE id = NEW.variant_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply inventory movement trigger
CREATE TRIGGER handle_inventory_movement
    AFTER INSERT ON inventory_movements
    FOR EACH ROW EXECUTE FUNCTION handle_inventory_movement();
