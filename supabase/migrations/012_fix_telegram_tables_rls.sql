-- Migration: Fix RLS for Telegram Tables
-- Enables Row Level Security and adds appropriate policies for telegram-related tables

-- Enable RLS on telegram tables
ALTER TABLE telegram_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_stock_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_stock_product_matches ENABLE ROW LEVEL SECURITY;

-- Telegram notifications table policies (admin only)
-- These notifications are for order management and should only be accessible by admins
CREATE POLICY "Admins can manage telegram notifications" ON telegram_notifications
    FOR ALL USING (is_admin(auth.uid()));

-- Telegram stock updates table policies (admin only)
-- Stock updates from Telegram are system-level operations that only admins should access
CREATE POLICY "Admins can manage telegram stock updates" ON telegram_stock_updates
    FOR ALL USING (is_admin(auth.uid()));

-- Telegram stock product matches table policies (admin only)
-- Product matching data is for admin analysis and system monitoring
CREATE POLICY "Admins can manage telegram stock product matches" ON telegram_stock_product_matches
    FOR ALL USING (is_admin(auth.uid()));

-- Add comments for documentation
COMMENT ON POLICY "Admins can manage telegram notifications" ON telegram_notifications 
    IS 'Only admin users can access Telegram notification records for order management';

COMMENT ON POLICY "Admins can manage telegram stock updates" ON telegram_stock_updates 
    IS 'Only admin users can access Telegram stock update logs and processing data';

COMMENT ON POLICY "Admins can manage telegram stock product matches" ON telegram_stock_product_matches 
    IS 'Only admin users can access product matching data for stock update analysis';
