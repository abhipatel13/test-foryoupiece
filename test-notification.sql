-- Test SQL to create notifications for testing
-- Replace the user_id with your actual user ID

INSERT INTO notifications (user_id, title, message, type, read, metadata) VALUES
('719702ec-d425-4949-9066-e8cd20b97ce6', 'Welcome!', 'Welcome to ForYouPiece! Start exploring our amazing Japanese products.', 'success', false, '{"welcome": true}'),
('719702ec-d425-4949-9066-e8cd20b97ce6', 'Order Update', 'Your order #12345 has been shipped and is on its way!', 'info', false, '{"order_id": "12345"}'),
('719702ec-d425-4949-9066-e8cd20b97ce6', 'Points Earned', 'You earned 50 points from your recent purchase!', 'success', false, '{"points": 50}'),
('719702ec-d425-4949-9066-e8cd20b97ce6', 'New Product Alert', 'Check out our latest Japanese snacks - now available!', 'info', false, '{"product_alert": true}'),
('719702ec-d425-4949-9066-e8cd20b97ce6', 'Special Offer', 'Get 20% off on your next order with code SAVE20!', 'success', false, '{"coupon": "SAVE20"}');
