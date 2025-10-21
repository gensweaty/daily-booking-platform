-- Add fields to track who created custom reminders
ALTER TABLE public.custom_reminders 
ADD COLUMN IF NOT EXISTS created_by_type TEXT,
ADD COLUMN IF NOT EXISTS created_by_sub_user_id UUID,
ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.custom_reminders.created_by_type IS 'Type of creator: admin or sub_user';
COMMENT ON COLUMN public.custom_reminders.created_by_sub_user_id IS 'Sub-user ID if created by sub-user';
COMMENT ON COLUMN public.custom_reminders.created_by_name IS 'Name of the creator for display';