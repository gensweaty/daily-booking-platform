
-- Add group booking support to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS group_name VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_group_event BOOLEAN DEFAULT false;

-- Add group booking support to customers table  
ALTER TABLE customers ADD COLUMN IF NOT EXISTS parent_group_id UUID;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_group_member BOOLEAN DEFAULT false;

-- Add index for better performance on group queries
CREATE INDEX IF NOT EXISTS idx_customers_parent_group_id ON customers(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_events_is_group_event ON events(is_group_event);
