
-- Add archived functionality to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Create index for better performance when filtering archived tasks
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_tasks_archived_at ON tasks(archived_at) WHERE archived = true;
