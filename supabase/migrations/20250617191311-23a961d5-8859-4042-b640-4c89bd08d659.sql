
-- Add group booking support to events table (backward compatible)
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS is_group_event boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS group_name text,
ADD COLUMN IF NOT EXISTS parent_group_id uuid;

-- Add index for better performance on group queries
CREATE INDEX IF NOT EXISTS idx_events_parent_group_id ON public.events(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_events_is_group_event ON public.events(is_group_event);
