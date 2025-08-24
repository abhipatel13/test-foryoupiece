-- Enable pgmq extension for durable queues
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create email_outbox table for transactional outbox pattern
CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('order_confirmation', 'order_shipped', 'order_cancelled', 'order_refunded')),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Create unique index to prevent duplicate email types per order
CREATE UNIQUE INDEX IF NOT EXISTS uniq_outbox_order_email_type 
ON email_outbox (order_id, email_type);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_outbox_status_next_retry 
ON email_outbox (status, next_retry_at) 
WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_email_outbox_created_at 
ON email_outbox (created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_email_outbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_outbox_updated_at
  BEFORE UPDATE ON email_outbox
  FOR EACH ROW
  EXECUTE FUNCTION update_email_outbox_updated_at();

-- Enhanced email_logs table for better tracking
ALTER TABLE email_logs 
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'resend',
ADD COLUMN IF NOT EXISTS provider_id TEXT,
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'bounced', 'complained', 'opened', 'clicked')),
ADD COLUMN IF NOT EXISTS delivery_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bounce_reason TEXT,
ADD COLUMN IF NOT EXISTS outbox_id UUID REFERENCES email_outbox(id) ON DELETE SET NULL;

-- Create index for provider tracking
CREATE INDEX IF NOT EXISTS idx_email_logs_provider_id 
ON email_logs (provider, provider_id) 
WHERE provider_id IS NOT NULL;

-- Create the email queue using pgmq
SELECT pgmq.create_queue('emails');

-- Function to enqueue email messages
CREATE OR REPLACE FUNCTION enqueue_email_message(
  p_order_id UUID,
  p_email_type TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  outbox_id UUID;
  queue_message JSONB;
BEGIN
  -- Insert into outbox table (idempotent)
  INSERT INTO email_outbox (order_id, email_type, payload)
  VALUES (p_order_id, p_email_type, p_payload)
  ON CONFLICT (order_id, email_type) DO UPDATE SET
    payload = EXCLUDED.payload,
    status = 'pending',
    attempts = 0,
    next_retry_at = NULL,
    error_message = NULL,
    updated_at = NOW()
  RETURNING id INTO outbox_id;

  -- Prepare queue message
  queue_message := jsonb_build_object(
    'outbox_id', outbox_id,
    'order_id', p_order_id,
    'email_type', p_email_type,
    'payload', p_payload,
    'created_at', NOW()
  );

  -- Send to queue
  PERFORM pgmq.send('emails', queue_message);

  RETURN outbox_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark email as processing
CREATE OR REPLACE FUNCTION mark_email_processing(p_outbox_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE email_outbox 
  SET 
    status = 'processing',
    attempts = attempts + 1,
    updated_at = NOW()
  WHERE id = p_outbox_id AND status IN ('pending', 'failed');
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark email as sent
CREATE OR REPLACE FUNCTION mark_email_sent(
  p_outbox_id UUID,
  p_provider_id TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE email_outbox 
  SET 
    status = 'sent',
    processed_at = NOW(),
    updated_at = NOW(),
    error_message = NULL
  WHERE id = p_outbox_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark email as failed with retry logic
CREATE OR REPLACE FUNCTION mark_email_failed(
  p_outbox_id UUID,
  p_error_message TEXT,
  p_retry_delay_minutes INTEGER DEFAULT 5
) RETURNS BOOLEAN AS $$
DECLARE
  current_attempts INTEGER;
  max_attempts INTEGER;
  new_status TEXT;
  next_retry TIMESTAMPTZ;
BEGIN
  SELECT attempts, max_attempts INTO current_attempts, max_attempts
  FROM email_outbox WHERE id = p_outbox_id;
  
  -- Determine if we should retry or mark as dead letter
  IF current_attempts >= max_attempts THEN
    new_status := 'dead_letter';
    next_retry := NULL;
  ELSE
    new_status := 'failed';
    -- Exponential backoff: 5min, 10min, 20min
    next_retry := NOW() + (p_retry_delay_minutes * POWER(2, current_attempts - 1)) * INTERVAL '1 minute';
  END IF;
  
  UPDATE email_outbox 
  SET 
    status = new_status,
    error_message = p_error_message,
    next_retry_at = next_retry,
    updated_at = NOW()
  WHERE id = p_outbox_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending emails for processing
CREATE OR REPLACE FUNCTION get_pending_emails(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  outbox_id UUID,
  order_id UUID,
  email_type TEXT,
  payload JSONB,
  attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eo.id,
    eo.order_id,
    eo.email_type,
    eo.payload,
    eo.attempts
  FROM email_outbox eo
  WHERE eo.status IN ('pending', 'failed')
    AND (eo.next_retry_at IS NULL OR eo.next_retry_at <= NOW())
  ORDER BY eo.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA pgmq_public TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA pgmq_public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA pgmq_public TO service_role;

-- Grant permissions on email functions
GRANT EXECUTE ON FUNCTION enqueue_email_message TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_email_processing TO service_role;
GRANT EXECUTE ON FUNCTION mark_email_sent TO service_role;
GRANT EXECUTE ON FUNCTION mark_email_failed TO service_role;
GRANT EXECUTE ON FUNCTION get_pending_emails TO service_role;

-- Grant table permissions
GRANT ALL ON email_outbox TO service_role;
GRANT SELECT, INSERT, UPDATE ON email_outbox TO authenticated;
