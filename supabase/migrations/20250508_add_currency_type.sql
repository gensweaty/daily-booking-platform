
-- Add currency_type column to events table if it doesn't already exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'currency_type') THEN
        ALTER TABLE public.events ADD COLUMN currency_type text;
    END IF;
END $$;

-- Add currency_type column to booking_requests table if it doesn't already exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'booking_requests' AND column_name = 'currency_type') THEN
        ALTER TABLE public.booking_requests ADD COLUMN currency_type text;
    END IF;
END $$;

-- Add currency_type column to customers table if it doesn't already exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'currency_type') THEN
        ALTER TABLE public.customers ADD COLUMN currency_type text;
    END IF;
END $$;

-- Update any existing records with currency type based on language preferences
-- This is a simple placeholder. In production, you would need more complex logic
-- to determine the appropriate currency for each record.
