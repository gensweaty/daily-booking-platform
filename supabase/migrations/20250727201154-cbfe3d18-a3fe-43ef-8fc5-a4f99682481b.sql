
-- Add email reminder fields to tasks table
ALTER TABLE tasks 
ADD COLUMN send_email_reminder BOOLEAN DEFAULT FALSE,
ADD COLUMN reminder_sent BOOLEAN DEFAULT FALSE;
