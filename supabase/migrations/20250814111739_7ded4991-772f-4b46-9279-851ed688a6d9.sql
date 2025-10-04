-- Add permission columns to sub_users table
ALTER TABLE public.sub_users 
ADD COLUMN calendar_permission BOOLEAN DEFAULT false,
ADD COLUMN crm_permission BOOLEAN DEFAULT false,
ADD COLUMN statistics_permission BOOLEAN DEFAULT false;

-- Add created_by and last_edited_by tracking to customers table
ALTER TABLE public.customers 
ADD COLUMN created_by_type TEXT DEFAULT 'admin',
ADD COLUMN created_by_name TEXT,
ADD COLUMN last_edited_by_type TEXT,
ADD COLUMN last_edited_by_name TEXT,
ADD COLUMN last_edited_at TIMESTAMP WITH TIME ZONE;

-- Add created_by and last_edited_by tracking to events table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'created_by_type') THEN
        ALTER TABLE public.events 
        ADD COLUMN created_by_type TEXT DEFAULT 'admin',
        ADD COLUMN created_by_name TEXT,
        ADD COLUMN last_edited_by_type TEXT,
        ADD COLUMN last_edited_by_name TEXT,
        ADD COLUMN last_edited_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;