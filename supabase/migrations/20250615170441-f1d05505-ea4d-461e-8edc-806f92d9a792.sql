
-- Add only the missing group_name field to events table (is_group_event already exists)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS group_name VARCHAR;

-- Add group relationship fields to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS parent_group_id UUID REFERENCES events(id),
ADD COLUMN IF NOT EXISTS is_group_member BOOLEAN DEFAULT false;

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_customers_parent_group_id ON customers(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_events_is_group_event ON events(is_group_event);
