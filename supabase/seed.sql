-- Seed data for ForYouPiece E-commerce Platform
-- Test data for development and testing

-- Insert sample categories
INSERT INTO categories (name_en, name_ja, description_en, description_ja, slug, sort_order) VALUES
('Electronics', 'エレクトロニクス', 'Japanese electronics and gadgets', '日本の電子機器とガジェット', 'electronics', 1),
('Fashion', 'ファッション', 'Japanese fashion and accessories', '日本のファッションとアクセサリー', 'fashion', 2),
('Food & Beverages', '食品・飲料', 'Japanese food and drinks', '日本の食品と飲み物', 'food-beverages', 3),
('Beauty & Health', '美容・健康', 'Japanese beauty and health products', '日本の美容・健康商品', 'beauty-health', 4),
('Home & Living', 'ホーム・リビング', 'Japanese home and living items', '日本のホーム・リビング用品', 'home-living', 5),
('Toys & Games', 'おもちゃ・ゲーム', 'Japanese toys and games', '日本のおもちゃとゲーム', 'toys-games', 6),
('Books & Media', '本・メディア', 'Japanese books and media', '日本の本とメディア', 'books-media', 7),
('Sports & Outdoors', 'スポーツ・アウトドア', 'Japanese sports and outdoor gear', '日本のスポーツ・アウトドア用品', 'sports-outdoors', 8);

-- Insert sample products
INSERT INTO products (
    sku, name_en, name_ja, description_en, description_ja, 
    short_description_en, short_description_ja, price, compare_at_price,
    images, category_id, brand, weight_grams, is_featured, tags
) VALUES
(
    'SONY-WH1000XM5',
    'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
    'ソニー WH-1000XM5 ワイヤレスノイズキャンセリングヘッドホン',
    'Industry-leading noise canceling with Dual Noise Sensor technology. Next-level music with Edge-AI, for the ultimate listening experience.',
    '業界最高クラスのノイズキャンセリング機能を搭載したワイヤレスヘッドホン。Edge-AIによる次世代の音楽体験をお楽しみください。',
    'Premium wireless headphones with industry-leading noise canceling',
    'プレミアムワイヤレスヘッドホン',
    45000.00,
    50000.00,
    ARRAY['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'],
    (SELECT id FROM categories WHERE slug = 'electronics'),
    'Sony',
    250,
    true,
    ARRAY['headphones', 'wireless', 'noise-canceling', 'premium']
),
(
    'UNIQLO-HEATTECH-SHIRT',
    'UNIQLO Heattech Crew Neck Long Sleeve T-Shirt',
    'ユニクロ ヒートテック クルーネック長袖Tシャツ',
    'Ultra-warm HEATTECH fabric retains body heat and releases moisture for all-day comfort.',
    '体温を逃がさず、汗などの水分を放出するヒートテック素材で一日中快適。',
    'Warm and comfortable base layer for cold weather',
    '寒い季節に最適な暖かいインナー',
    1500.00,
    2000.00,
    ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500'],
    (SELECT id FROM categories WHERE slug = 'fashion'),
    'UNIQLO',
    150,
    true,
    ARRAY['clothing', 'winter', 'base-layer', 'heattech']
),
(
    'POCKY-CHOCOLATE',
    'Glico Pocky Chocolate Biscuit Sticks',
    'グリコ ポッキー チョコレート',
    'Crispy biscuit sticks covered in smooth chocolate. A beloved Japanese snack enjoyed worldwide.',
    'サクサクのビスケットにチョコレートをコーティングした、世界中で愛される日本のお菓子。',
    'Classic Japanese chocolate biscuit sticks',
    '定番の日本のチョコレートビスケット',
    300.00,
    null,
    ARRAY['https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=500'],
    (SELECT id FROM categories WHERE slug = 'food-beverages'),
    'Glico',
    50,
    false,
    ARRAY['snacks', 'chocolate', 'biscuit', 'japanese-sweets']
),
(
    'SHISEIDO-SUNSCREEN',
    'Shiseido Anessa Perfect UV Sunscreen',
    '資生堂 アネッサ パーフェクトUV 日焼け止め',
    'Ultimate UV protection with sweat and water resistance. Perfect for outdoor activities and daily use.',
    '汗・水に強い最強UV防御。アウトドアや日常使いに最適な日焼け止め。',
    'Premium Japanese sunscreen with ultimate UV protection',
    'プレミアム日本製日焼け止め',
    2800.00,
    3200.00,
    ARRAY['https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500'],
    (SELECT id FROM categories WHERE slug = 'beauty-health'),
    'Shiseido',
    60,
    true,
    ARRAY['sunscreen', 'skincare', 'uv-protection', 'waterproof']
),
(
    'NINTENDO-SWITCH-OLED',
    'Nintendo Switch OLED Model',
    'Nintendo Switch（有機ELモデル）',
    'Play at home or on the go with the Nintendo Switch OLED model featuring a vibrant 7-inch OLED screen.',
    '鮮やかな7インチ有機ELディスプレイを搭載したNintendo Switch。家でも外でもゲームを楽しめます。',
    'Latest Nintendo Switch with OLED display',
    '有機ELディスプレイ搭載の最新Nintendo Switch',
    38000.00,
    42000.00,
    ARRAY['https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=500'],
    (SELECT id FROM categories WHERE slug = 'toys-games'),
    'Nintendo',
    420,
    true,
    ARRAY['gaming', 'console', 'portable', 'oled']
);

-- Insert product variants for some products
INSERT INTO product_variants (product_id, sku, title, option1, price, stock_quantity) VALUES
(
    (SELECT id FROM products WHERE sku = 'UNIQLO-HEATTECH-SHIRT'),
    'UNIQLO-HEATTECH-SHIRT-S-BLACK',
    'Small / Black',
    'Small',
    1500.00,
    50
),
(
    (SELECT id FROM products WHERE sku = 'UNIQLO-HEATTECH-SHIRT'),
    'UNIQLO-HEATTECH-SHIRT-M-BLACK',
    'Medium / Black',
    'Medium',
    1500.00,
    75
),
(
    (SELECT id FROM products WHERE sku = 'UNIQLO-HEATTECH-SHIRT'),
    'UNIQLO-HEATTECH-SHIRT-L-BLACK',
    'Large / Black',
    'Large',
    1500.00,
    60
),
(
    (SELECT id FROM products WHERE sku = 'UNIQLO-HEATTECH-SHIRT'),
    'UNIQLO-HEATTECH-SHIRT-S-WHITE',
    'Small / White',
    'Small',
    1500.00,
    40
),
(
    (SELECT id FROM products WHERE sku = 'UNIQLO-HEATTECH-SHIRT'),
    'UNIQLO-HEATTECH-SHIRT-M-WHITE',
    'Medium / White',
    'Medium',
    1500.00,
    65
),
(
    (SELECT id FROM products WHERE sku = 'UNIQLO-HEATTECH-SHIRT'),
    'UNIQLO-HEATTECH-SHIRT-L-WHITE',
    'Large / White',
    'Large',
    1500.00,
    55
);

-- Update product stock quantities based on variants
UPDATE products SET stock_quantity = (
    SELECT COALESCE(SUM(stock_quantity), 0) 
    FROM product_variants 
    WHERE product_id = products.id
) WHERE id IN (
    SELECT DISTINCT product_id FROM product_variants
);

-- Set stock quantities for products without variants
UPDATE products SET stock_quantity = 25 WHERE sku = 'SONY-WH1000XM5';
UPDATE products SET stock_quantity = 100 WHERE sku = 'POCKY-CHOCOLATE';
UPDATE products SET stock_quantity = 30 WHERE sku = 'SHISEIDO-SUNSCREEN';
UPDATE products SET stock_quantity = 15 WHERE sku = 'NINTENDO-SWITCH-OLED';

-- Create a test admin user (you'll need to replace with actual user ID after authentication)
-- This is just a placeholder - in real implementation, you'd create this after user signs up
-- INSERT INTO admin_users (user_id, role, permissions) VALUES
-- ('00000000-0000-0000-0000-000000000000', 'super_admin', '{"all": true}');

-- Insert some sample point transaction types for reference
-- These would be created automatically by the system, but here for testing
-- INSERT INTO point_transactions (user_id, points, transaction_type, reference_type, description) VALUES
-- ('00000000-0000-0000-0000-000000000000', 100, 'bonus', 'signup', 'Welcome bonus for new user'),
-- ('00000000-0000-0000-0000-000000000000', 450, 'earned', 'order', 'Points earned from order FYP-20240101-001');
