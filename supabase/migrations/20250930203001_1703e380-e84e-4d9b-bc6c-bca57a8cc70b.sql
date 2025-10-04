-- Add assignment fields to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS assigned_to_type TEXT CHECK (assigned_to_type IN ('admin', 'sub_user')),
ADD COLUMN IF NOT EXISTS assigned_to_id UUID,
ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
ADD COLUMN IF NOT EXISTS assigned_to_avatar_url TEXT,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assigned_by_type TEXT CHECK (assigned_by_type IN ('admin', 'sub_user')),
ADD COLUMN IF NOT EXISTS assigned_by_id UUID;

-- Add comment for clarity
COMMENT ON COLUMN tasks.assigned_to_type IS 'Type of assignee: admin or sub_user';
COMMENT ON COLUMN tasks.assigned_to_id IS 'ID of the assigned user (either from auth.users or sub_users)';
COMMENT ON COLUMN tasks.assigned_to_name IS 'Display name of assigned user';
COMMENT ON COLUMN tasks.assigned_to_avatar_url IS 'Avatar URL of assigned user';
COMMENT ON COLUMN tasks.assigned_at IS 'When the task was assigned';
COMMENT ON COLUMN tasks.assigned_by_type IS 'Type of user who assigned: admin or sub_user';
COMMENT ON COLUMN tasks.assigned_by_id IS 'ID of user who made the assignment';