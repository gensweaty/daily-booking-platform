
-- Add group booking support to events table (backward compatible)
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS is_group_event boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS group_name text,
ADD COLUMN IF NOT EXISTS parent_group_id uuid;

-- Add group booking support to customers table (backward compatible)
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS parent_group_id uuid,
ADD COLUMN IF NOT EXISTS is_group_member boolean DEFAULT false;

-- Add indexes for better performance on group queries
CREATE INDEX IF NOT EXISTS idx_events_parent_group_id ON public.events(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_events_is_group_event ON public.events(is_group_event);
CREATE INDEX IF NOT EXISTS idx_customers_parent_group_id ON public.customers(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_customers_is_group_member ON public.customers(is_group_member);
