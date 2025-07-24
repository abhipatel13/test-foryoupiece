-- ForYouPiece E-commerce Database Schema
-- Phase 2: Comprehensive Database Architecture

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');
CREATE TYPE payment_status AS ENUM ('pending', 'verified', 'failed', 'refunded');
CREATE TYPE fulfillment_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE stock_status AS ENUM ('in_stock', 'low_stock', 'out_of_stock', 'preorder');
CREATE TYPE transaction_type AS ENUM ('earned', 'redeemed', 'expired', 'bonus', 'refund');
CREATE TYPE reference_type AS ENUM ('order', 'signup', 'referral', 'admin_adjustment');

-- Categories table (must be created first due to foreign key)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    description_en TEXT,
    description_ja TEXT,
    slug TEXT UNIQUE NOT NULL,
    parent_id UUID REFERENCES categories(id),
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_id BIGINT UNIQUE,
    telegram_username TEXT,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    points_balance INTEGER DEFAULT 0 CHECK (points_balance >= 0),
    tier_level user_tier DEFAULT 'bronze',
    total_spent DECIMAL(12,2) DEFAULT 0 CHECK (total_spent >= 0),
    total_orders INTEGER DEFAULT 0 CHECK (total_orders >= 0),
    preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'ja')),
    marketing_consent BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    name_en TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    description_en TEXT,
    description_ja TEXT,
    short_description_en TEXT,
    short_description_ja TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    compare_at_price DECIMAL(10,2) CHECK (compare_at_price >= price),
    cost_price DECIMAL(10,2) CHECK (cost_price >= 0),
    images TEXT[] DEFAULT '{}',
    category_id UUID REFERENCES categories(id),
    brand TEXT,
    weight_grams INTEGER,
    dimensions JSONB, -- {length, width, height}
    is_preorder BOOLEAN DEFAULT FALSE,
    preorder_date TIMESTAMPTZ,
    preorder_limit INTEGER,
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    stock_status stock_status DEFAULT 'in_stock',
    low_stock_threshold INTEGER DEFAULT 5,
    track_inventory BOOLEAN DEFAULT TRUE,
    allow_backorder BOOLEAN DEFAULT FALSE,
    requires_shipping BOOLEAN DEFAULT TRUE,
    is_digital BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    seo_title TEXT,
    seo_description TEXT,
    tags TEXT[] DEFAULT '{}',
    vendor TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product variants table (for size, color, etc.)
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    option1 TEXT, -- e.g., "Size"
    option2 TEXT, -- e.g., "Color"
    option3 TEXT, -- e.g., "Material"
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    compare_at_price DECIMAL(10,2),
    cost_price DECIMAL(10,2),
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    weight_grams INTEGER,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    currency TEXT DEFAULT 'JPY' CHECK (currency IN ('JPY', 'USD', 'EUR')),
    subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
    shipping_cost DECIMAL(12,2) DEFAULT 0 CHECK (shipping_cost >= 0),
    tax_amount DECIMAL(12,2) DEFAULT 0 CHECK (tax_amount >= 0),
    discount_amount DECIMAL(12,2) DEFAULT 0 CHECK (discount_amount >= 0),
    points_used INTEGER DEFAULT 0 CHECK (points_used >= 0),
    points_earned INTEGER DEFAULT 0 CHECK (points_earned >= 0),
    total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
    payment_status payment_status DEFAULT 'pending',
    payment_method TEXT DEFAULT 'bank_transfer',
    payment_reference TEXT,
    bank_transfer_proof TEXT,
    payment_verified_at TIMESTAMPTZ,
    payment_verified_by UUID REFERENCES users(id),
    fulfillment_status fulfillment_status DEFAULT 'pending',
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    tracking_number TEXT,
    shipping_address JSONB NOT NULL,
    billing_address JSONB,
    notes TEXT,
    admin_notes TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    sku TEXT NOT NULL,
    title TEXT NOT NULL,
    variant_title TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Point transactions table
CREATE TABLE point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    transaction_type transaction_type NOT NULL,
    reference_type reference_type,
    reference_id UUID,
    description TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory movements table
CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference_type TEXT CHECK (reference_type IN ('purchase', 'sale', 'return', 'damage', 'adjustment')),
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Preorder queue table
CREATE TABLE preorder_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    queue_position INTEGER NOT NULL,
    notification_sent BOOLEAN DEFAULT FALSE,
    fulfilled_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, user_id, variant_id)
);

-- Payment verifications table (admin workflow)
CREATE TABLE payment_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    bank_transfer_proof TEXT,
    transfer_amount DECIMAL(12,2),
    transfer_date TIMESTAMPTZ,
    transfer_reference TEXT,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shopping cart table (persistent cart)
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id, variant_id)
);

-- Wishlist table
CREATE TABLE wishlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id, variant_id)
);

-- Admin users table (for role-based access)
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'moderator', 'support')),
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
