
-- Add recurring event columns to the events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS repeat_pattern text,
ADD COLUMN IF NOT EXISTS repeat_until date,
ADD COLUMN IF NOT EXISTS parent_event_id uuid;

-- Add index for better performance when querying recurring events
CREATE INDEX IF NOT EXISTS idx_events_parent_event_id ON public.events(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_events_is_recurring ON public.events(is_recurring);
