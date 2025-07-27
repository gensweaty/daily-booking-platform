
-- Add timezone column to tasks table
ALTER TABLE tasks ADD COLUMN timezone TEXT DEFAULT 'UTC';

-- Update existing tasks to have UTC timezone
UPDATE tasks SET timezone = 'UTC' WHERE timezone IS NULL;

-- Add timezone column to profiles table if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
