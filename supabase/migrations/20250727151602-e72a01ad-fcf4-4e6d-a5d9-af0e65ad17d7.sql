
-- Add email_reminder column to tasks table
ALTER TABLE tasks ADD COLUMN email_reminder BOOLEAN DEFAULT FALSE;
