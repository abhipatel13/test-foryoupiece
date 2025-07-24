-- Add checkout-related fields to users table
-- Migration: 002_add_checkout_fields.sql
-- Description: Add address and ABA bank name fields for checkout functionality

-- Add new columns to users table
ALTER TABLE users 
ADD COLUMN address_line_1 TEXT,
ADD COLUMN address_line_2 TEXT,
ADD COLUMN aba_bank_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN users.address_line_1 IS 'Primary address line for shipping (required for checkout)';
COMMENT ON COLUMN users.address_line_2 IS 'Secondary address line for shipping (optional)';
COMMENT ON COLUMN users.aba_bank_name IS 'ABA bank name for payment processing';

-- Update the updated_at trigger to include new columns
-- (The trigger already exists from the initial migration, this ensures it covers new columns)
