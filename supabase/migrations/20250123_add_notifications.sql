-- Create notifications table for user notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    read BOOLEAN DEFAULT FALSE,
    related_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Create function to send order status change notifications
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only send notification if fulfillment_status changed from 'on_hold' to 'processing'
    IF OLD.fulfillment_status = 'on_hold' AND NEW.fulfillment_status = 'processing' THEN
        INSERT INTO notifications (user_id, title, message, type, related_order_id)
        VALUES (
            NEW.user_id,
            'Order Status Updated',
            'Your order #' || NEW.order_number || ' has been processed and will be shipped soon!',
            'success',
            NEW.id
        );
    END IF;
    
    -- Send notification when order is shipped
    IF OLD.fulfillment_status != 'shipped' AND NEW.fulfillment_status = 'shipped' THEN
        INSERT INTO notifications (user_id, title, message, type, related_order_id)
        VALUES (
            NEW.user_id,
            'Order Shipped',
            'Your order #' || NEW.order_number || ' has been shipped and is on its way to you!',
            'success',
            NEW.id
        );
    END IF;
    
    -- Send notification when order is delivered
    IF OLD.fulfillment_status != 'delivered' AND NEW.fulfillment_status = 'delivered' THEN
        INSERT INTO notifications (user_id, title, message, type, related_order_id)
        VALUES (
            NEW.user_id,
            'Order Delivered',
            'Your order #' || NEW.order_number || ' has been delivered successfully!',
            'success',
            NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order status changes
CREATE TRIGGER order_status_change_notification
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_order_status_change();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for notifications updated_at
CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
