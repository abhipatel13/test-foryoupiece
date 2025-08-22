-- Promotional Events System
-- Create enum for event types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
    CREATE TYPE event_type AS ENUM (
      'free_shipping',
      'percentage_discount',
      'product_discount',
      'sitewide_discount',
      'custom'
    );
  END IF;
END $$;

-- Create promotional_events table
CREATE TABLE IF NOT EXISTS promotional_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Audit
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_event_time CHECK (ends_at IS NULL OR ends_at > starts_at)
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_promotional_events_type ON promotional_events(event_type);
CREATE INDEX IF NOT EXISTS idx_promotional_events_active ON promotional_events(is_active);
CREATE INDEX IF NOT EXISTS idx_promotional_events_time ON promotional_events(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_promotional_events_active_window ON promotional_events((is_active AND starts_at <= NOW() AND (ends_at IS NULL OR ends_at >= NOW())));

-- Enable RLS
ALTER TABLE promotional_events ENABLE ROW LEVEL SECURITY;

-- Policies: admins only for now
CREATE POLICY IF NOT EXISTS "Admins can view promotional events" ON promotional_events
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS "Admins can manage promotional events" ON promotional_events
  FOR ALL
  USING (is_admin(auth.uid()));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION set_promotional_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_promotional_events_updated_at ON promotional_events;
CREATE TRIGGER trg_promotional_events_updated_at
BEFORE UPDATE ON promotional_events
FOR EACH ROW EXECUTE FUNCTION set_promotional_events_updated_at();

-- View for currently active events (optional helper for analytics)
CREATE OR REPLACE VIEW active_promotional_events AS
SELECT * FROM promotional_events
WHERE is_active = TRUE
  AND starts_at <= NOW()
  AND (ends_at IS NULL OR ends_at >= NOW());

