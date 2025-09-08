-- Create telegram_thread_memory table for Staff Helper Bot conversation persistence
-- Stores recent turns and last updated timestamp. Access via service role only.

CREATE TABLE IF NOT EXISTS telegram_thread_memory (
  thread_key TEXT PRIMARY KEY,
  turns JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS; service role will bypass RLS automatically. No anon access policies are added.
ALTER TABLE telegram_thread_memory ENABLE ROW LEVEL SECURITY;

-- Optional index to speed up updated_at queries (housekeeping/debug)
CREATE INDEX IF NOT EXISTS idx_telegram_thread_memory_updated_at ON telegram_thread_memory(updated_at DESC);

