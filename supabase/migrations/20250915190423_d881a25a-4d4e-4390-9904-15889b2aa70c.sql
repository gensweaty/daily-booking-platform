-- Fix storage RLS policies for external board access

-- Drop existing policies on objects table
DROP POLICY IF EXISTS "Enable access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON storage.objects;
DROP POLICY IF EXISTS "Enable select for authenticated users only" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON storage.objects;

-- Create comprehensive storage policies for customer_attachments bucket
CREATE POLICY "Users can upload to customer attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'customer_attachments' AND 
  (
    auth.uid() = owner OR
    owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

CREATE POLICY "Users can view customer attachments" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'customer_attachments' AND 
  (
    auth.uid() = owner OR
    owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

CREATE POLICY "Users can update customer attachments" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'customer_attachments' AND 
  (
    auth.uid() = owner OR
    owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

CREATE POLICY "Users can delete customer attachments" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'customer_attachments' AND 
  (
    auth.uid() = owner OR
    owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

-- Create comprehensive storage policies for event_attachments bucket
CREATE POLICY "Users can upload to event attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'event_attachments' AND 
  (
    auth.uid() = owner OR
    owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

CREATE POLICY "Users can view event attachments" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'event_attachments' AND 
  (
    auth.uid() = owner OR
    owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

CREATE POLICY "Users can update event attachments" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'event_attachments' AND 
  (
    auth.uid() = owner OR
    owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

CREATE POLICY "Users can delete event attachments" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'event_attachments' AND 
  (
    auth.uid() = owner OR
    owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

-- Allow authenticated users to manage other buckets normally
CREATE POLICY "Allow authenticated users to manage general storage" 
ON storage.objects 
FOR ALL 
USING (
  bucket_id NOT IN ('customer_attachments', 'event_attachments') AND 
  auth.uid() = owner
);