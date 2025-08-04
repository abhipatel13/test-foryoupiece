-- Update RLS policy for products table to allow service role operations
-- This allows both admin users and service role operations to manage products

-- Drop the existing policy
DROP POLICY IF EXISTS "Admins can manage products" ON products;

-- Create the updated policy that allows service role operations
CREATE POLICY "Admins can manage products" ON products
    FOR ALL USING (
        auth.role() = 'service_role' OR is_admin(auth.uid())
    );
