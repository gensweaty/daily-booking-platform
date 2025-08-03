
-- Check if reminder fields exist in events table and add them if needed
DO $$
BEGIN
    -- Add reminder_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'reminder_at') THEN
        ALTER TABLE events ADD COLUMN reminder_at timestamp with time zone;
    END IF;
    
    -- Add email_reminder_enabled column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'email_reminder_enabled') THEN
        ALTER TABLE events ADD COLUMN email_reminder_enabled boolean DEFAULT false;
    END IF;
    
    -- Add reminder_sent_at column if it doesn't exist (for deduplication)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'reminder_sent_at') THEN
        ALTER TABLE events ADD COLUMN reminder_sent_at timestamp with time zone;
    END IF;
END $$;

-- Create index for efficient querying of due reminders
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_reminder_due 
ON events (reminder_at, email_reminder_enabled, reminder_sent_at) 
WHERE reminder_at IS NOT NULL AND email_reminder_enabled = true AND reminder_sent_at IS NULL;
