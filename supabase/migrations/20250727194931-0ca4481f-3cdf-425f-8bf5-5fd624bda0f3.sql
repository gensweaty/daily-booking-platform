
-- Add the missing reminder_sent column to tasks table
ALTER TABLE tasks 
ADD COLUMN reminder_sent BOOLEAN DEFAULT FALSE;

-- Add indexes for efficient querying of pending reminders
CREATE INDEX idx_tasks_reminder_pending 
ON tasks (email_reminder, reminder_sent, reminder_at) 
WHERE email_reminder = TRUE AND reminder_sent = FALSE;

-- Add index for reminder processing
CREATE INDEX idx_tasks_reminder_due 
ON tasks (reminder_at) 
WHERE email_reminder = TRUE AND reminder_sent = FALSE;
