-- Row Level Security (RLS) Policies
-- ForYouPiece E-commerce Platform

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE preorder_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.user_id = $1 AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users 
        WHERE admin_users.user_id = $1 AND role = 'super_admin' AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users table policies
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all users" ON users
    FOR UPDATE USING (is_admin(auth.uid()));

-- Categories table policies (public read, admin write)
CREATE POLICY "Anyone can view active categories" ON categories
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage categories" ON categories
    FOR ALL USING (is_admin(auth.uid()));

-- Products table policies (public read, admin write)
CREATE POLICY "Anyone can view active products" ON products
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage products" ON products
    FOR ALL USING (
        auth.role() = 'service_role' OR is_admin(auth.uid())
    );

-- Product variants table policies
CREATE POLICY "Anyone can view active product variants" ON product_variants
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage product variants" ON product_variants
    FOR ALL USING (is_admin(auth.uid()));

-- Orders table policies
CREATE POLICY "Users can view their own orders" ON orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders" ON orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending orders" ON orders
    FOR UPDATE USING (
        auth.uid() = user_id AND 
        payment_status = 'pending' AND 
        fulfillment_status = 'pending'
    );

CREATE POLICY "Admins can view all orders" ON orders
    FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all orders" ON orders
    FOR UPDATE USING (is_admin(auth.uid()));

-- Order items table policies
CREATE POLICY "Users can view their own order items" ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_items.order_id 
            AND orders.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert order items for their orders" ON order_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_items.order_id 
            AND orders.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all order items" ON order_items
    FOR ALL USING (is_admin(auth.uid()));

-- Point transactions table policies
CREATE POLICY "Users can view their own point transactions" ON point_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert point transactions" ON point_transactions
    FOR INSERT WITH CHECK (TRUE); -- Controlled by application logic

CREATE POLICY "Admins can view all point transactions" ON point_transactions
    FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert point transactions" ON point_transactions
    FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- Inventory movements table policies (admin only)
CREATE POLICY "Admins can manage inventory movements" ON inventory_movements
    FOR ALL USING (is_admin(auth.uid()));

-- Preorder queue table policies
CREATE POLICY "Users can view their own preorder queue" ON preorder_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own preorder queue" ON preorder_queue
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all preorder queue" ON preorder_queue
    FOR SELECT USING (is_admin(auth.uid()));

-- Payment verifications table policies (admin only)
CREATE POLICY "Admins can manage payment verifications" ON payment_verifications
    FOR ALL USING (is_admin(auth.uid()));

-- Cart items table policies
CREATE POLICY "Users can manage their own cart" ON cart_items
    FOR ALL USING (auth.uid() = user_id);

-- Wishlist items table policies
CREATE POLICY "Users can manage their own wishlist" ON wishlist_items
    FOR ALL USING (auth.uid() = user_id);

-- Admin users table policies
CREATE POLICY "Admins can view admin users" ON admin_users
    FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Super admins can manage admin users" ON admin_users
    FOR ALL USING (is_super_admin(auth.uid()));

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
