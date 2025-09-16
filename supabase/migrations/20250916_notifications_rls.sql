-- Enable RLS and policies for notifications table
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;

-- Allow users to select their own notifications
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can view their own notifications'
  ) THEN
    CREATE POLICY "Users can view their own notifications" ON notifications
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Allow users to update (mark read) their own notifications (optional, API uses service role)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users can update their own notifications'
  ) THEN
    CREATE POLICY "Users can update their own notifications" ON notifications
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Optional: Index to speed up user+read lookups if missing
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read) INCLUDE (created_at);

