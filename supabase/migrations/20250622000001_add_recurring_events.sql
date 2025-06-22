
-- Add recurring event support to events table
ALTER TABLE events 
ADD COLUMN repeat_pattern TEXT DEFAULT NULL,
ADD COLUMN repeat_until DATE DEFAULT NULL,
ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN parent_event_id UUID DEFAULT NULL REFERENCES events(id) ON DELETE CASCADE,
ADD COLUMN recurrence_instance_date DATE DEFAULT NULL;

-- Add index for better performance when querying recurring events
CREATE INDEX idx_events_recurring ON events(is_recurring, parent_event_id) WHERE is_recurring = TRUE OR parent_event_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN events.repeat_pattern IS 'JSON string containing recurrence pattern (daily, weekly, monthly, yearly)';
COMMENT ON COLUMN events.repeat_until IS 'Last date to generate recurring instances (max end of current year)';
COMMENT ON COLUMN events.is_recurring IS 'Whether this event is the parent of a recurring series';
COMMENT ON COLUMN events.parent_event_id IS 'Reference to parent event if this is a recurring instance';
COMMENT ON COLUMN events.recurrence_instance_date IS 'Original date this instance was supposed to occur (for edited instances)';
