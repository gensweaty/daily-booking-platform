
-- Add group booking fields to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_group_event boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS group_name character varying;
ALTER TABLE events ADD COLUMN IF NOT EXISTS parent_group_id uuid;
