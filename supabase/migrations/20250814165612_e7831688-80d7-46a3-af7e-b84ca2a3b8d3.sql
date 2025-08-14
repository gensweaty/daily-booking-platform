-- Fix critical security issues by enabling RLS and implementing proper policies

-- Enable RLS on all tables that need it
ALTER TABLE booking_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_files_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_board_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE redeem_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Fix customers table policies with proper security for public board functionality
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON customers;
CREATE POLICY "Enable insert access for users" 
ON customers 
FOR INSERT 
TO public
WITH CHECK (
  -- Allow authenticated users to insert their own data
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  -- Allow public board functionality where user_id exists in public_boards
  (auth.uid() IS NULL AND user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
);

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON customers;
CREATE POLICY "Enable read access for users" 
ON customers 
FOR SELECT 
TO public
USING (
  -- Allow authenticated users to see their own data
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  -- Allow public board functionality
  (user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
);

DROP POLICY IF EXISTS "Enable update access for users based on user_id" ON customers;
CREATE POLICY "Enable update access for users" 
ON customers 
FOR UPDATE 
TO public
USING (
  -- Allow authenticated users to update their own data
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  -- Allow public board functionality
  (user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
);

DROP POLICY IF EXISTS "Enable delete access for users based on user_id" ON customers;
CREATE POLICY "Enable delete access for users" 
ON customers 
FOR DELETE 
TO public
USING (
  -- Allow authenticated users to delete their own data
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  -- Allow public board functionality
  (user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
);

-- Fix events table policies with proper security
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON events;
CREATE POLICY "Enable insert access for users" 
ON events 
FOR INSERT 
TO public
WITH CHECK (
  -- Allow authenticated users to insert their own data
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  -- Allow public board functionality
  (auth.uid() IS NULL AND user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
);

DROP POLICY IF EXISTS "Enable update access for users based on user_id" ON events;
CREATE POLICY "Enable update access for users" 
ON events 
FOR UPDATE 
TO public
USING (
  -- Allow authenticated users to update their own data
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  -- Allow public board functionality
  (user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
);

DROP POLICY IF EXISTS "Enable delete access for users based on user_id" ON events;
CREATE POLICY "Enable delete access for users" 
ON events 
FOR DELETE 
TO public
USING (
  -- Allow authenticated users to delete their own data
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  -- Allow public board functionality
  (user_id IN (SELECT user_id FROM public_boards WHERE is_active = true))
);