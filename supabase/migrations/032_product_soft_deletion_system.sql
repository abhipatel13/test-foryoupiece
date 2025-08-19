-- Migration: Product Soft Deletion System
-- Description: Add comprehensive soft deletion fields to products table and create audit logging system
-- Date: 2025-01-19

-- Add soft deletion fields to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID NULL,
ADD COLUMN IF NOT EXISTS deleted_reason TEXT NULL;

-- Add foreign key constraint for deleted_by (references auth.users)
ALTER TABLE products 
ADD CONSTRAINT fk_products_deleted_by 
FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for soft deletion queries
CREATE INDEX IF NOT EXISTS idx_products_is_deleted ON products(is_deleted);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);
CREATE INDEX IF NOT EXISTS idx_products_active_not_deleted ON products(is_active, is_deleted) WHERE is_active = true AND is_deleted = false;

-- Create admin action logs table for audit trail
CREATE TABLE IF NOT EXISTS admin_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_email TEXT NOT NULL,
    actor_role TEXT NOT NULL CHECK (actor_role IN ('admin', 'super_admin')),
    action TEXT NOT NULL CHECK (action IN ('product_delete', 'product_restore', 'product_create', 'product_update', 'bulk_operation')),
    resource_type TEXT NOT NULL DEFAULT 'product',
    resource_id UUID,
    resource_sku TEXT,
    resource_name TEXT,
    reason TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for admin action logs
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_actor ON admin_action_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_action ON admin_action_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_resource ON admin_action_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at ON admin_action_logs(created_at DESC);

-- Add RLS policies for admin action logs
ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read their own logs or super_admins can read all
CREATE POLICY admin_action_logs_read_policy ON admin_action_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_users au
            WHERE au.user_id = auth.uid()
            AND (
                au.role = 'super_admin' 
                OR (au.role = 'admin' AND actor_user_id = auth.uid())
            )
        )
    );

-- Policy: Only service role can insert logs (API endpoints will use service role)
CREATE POLICY admin_action_logs_insert_policy ON admin_action_logs
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Create function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
    p_actor_user_id UUID,
    p_actor_email TEXT,
    p_actor_role TEXT,
    p_action TEXT,
    p_resource_type TEXT DEFAULT 'product',
    p_resource_id UUID DEFAULT NULL,
    p_resource_sku TEXT DEFAULT NULL,
    p_resource_name TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT TRUE,
    p_error_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO admin_action_logs (
        actor_user_id,
        actor_email,
        actor_role,
        action,
        resource_type,
        resource_id,
        resource_sku,
        resource_name,
        reason,
        success,
        error_message,
        metadata,
        ip_address,
        user_agent
    ) VALUES (
        p_actor_user_id,
        p_actor_email,
        p_actor_role,
        p_action,
        p_resource_type,
        p_resource_id,
        p_resource_sku,
        p_resource_name,
        p_reason,
        p_success,
        p_error_message,
        p_metadata,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION log_admin_action TO service_role;

-- Update existing products to ensure they have proper soft deletion defaults
UPDATE products 
SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL
WHERE is_deleted IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN products.is_deleted IS 'Soft deletion flag - true when product is deleted but preserved for audit';
COMMENT ON COLUMN products.deleted_at IS 'Timestamp when product was soft deleted';
COMMENT ON COLUMN products.deleted_by IS 'User ID who performed the deletion';
COMMENT ON COLUMN products.deleted_reason IS 'Optional reason for deletion';
COMMENT ON TABLE admin_action_logs IS 'Audit trail for all admin actions on products and other resources';
