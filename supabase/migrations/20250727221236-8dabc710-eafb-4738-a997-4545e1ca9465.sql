
-- Add email_reminder_enabled column to tasks table
ALTER TABLE tasks 
ADD COLUMN email_reminder_enabled BOOLEAN DEFAULT FALSE;

-- Add reminder_sent_at column to track when reminders were sent
ALTER TABLE tasks 
ADD COLUMN reminder_sent_at TIMESTAMP WITH TIME ZONE;
