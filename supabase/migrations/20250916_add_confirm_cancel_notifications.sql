-- Extend order status change notifications to cover payment confirmation and cancellations
-- This migration updates the existing trigger function to avoid breaking existing behavior

-- Replace the notify_order_status_change() function to add two new notifications:
-- 1) Order Confirmed: when payment_status changes to 'verified' while fulfillment is still pending/on_hold
-- 2) Order Cancelled: when fulfillment_status changes to 'cancelled'

CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Payment verified -> Order Confirmed (only if fulfillment not yet shipped/delivered/cancelled)
    IF (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
       AND NEW.payment_status = 'verified'
       AND NEW.fulfillment_status IN ('pending', 'on_hold', 'processing') THEN
        INSERT INTO notifications (user_id, title, message, type, related_order_id)
        VALUES (
            NEW.user_id,
            'Order Confirmed',
            'Your order #' || NEW.order_number || ' has been confirmed. We are preparing it!',
            'success',
            NEW.id
        );
    END IF;

    -- On Hold -> Processing (keep existing "processed" notification)
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

    -- Shipped (On the way)
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

    -- Delivered
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

    -- Cancelled
    IF OLD.fulfillment_status != 'cancelled' AND NEW.fulfillment_status = 'cancelled' THEN
        INSERT INTO notifications (user_id, title, message, type, related_order_id)
        VALUES (
            NEW.user_id,
            'Order Cancelled',
            'Your order #' || NEW.order_number || ' has been cancelled. If you have any questions, please contact support.',
            'warning',
            NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

