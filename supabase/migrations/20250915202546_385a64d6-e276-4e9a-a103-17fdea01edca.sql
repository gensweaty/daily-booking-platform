-- Fix RLS policies for customer_files_new to allow public board uploads
-- Drop existing INSERT policy for customer_files_new
DROP POLICY IF EXISTS "customer_files_insert_policy" ON public.customer_files_new;

-- Create new INSERT policy that allows uploads for public board users
CREATE POLICY "customer_files_insert_policy" ON public.customer_files_new
FOR INSERT
WITH CHECK (
  -- Allow authenticated users to upload their own files
  (user_id = auth.uid()) 
  OR 
  -- Allow sub-users to upload files for their board owner
  (EXISTS (
    SELECT 1
    FROM profiles p
    JOIN sub_users su ON (lower(su.email) = lower(p.username))
    WHERE p.id = auth.uid() AND su.board_owner_id = customer_files_new.user_id
  ))
  OR
  -- Allow uploads for active public board owners (for external users)
  (user_id IN (
    SELECT public_boards.user_id
    FROM public_boards
    WHERE public_boards.is_active = true
  ))
);

-- Update storage policies for customer_attachments bucket to allow public board uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer_attachments', 'customer_attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for customer_attachments bucket
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Customer attachments read access" ON storage.objects;
  DROP POLICY IF EXISTS "Customer attachments upload access" ON storage.objects;
  DROP POLICY IF EXISTS "Customer attachments update access" ON storage.objects;
  DROP POLICY IF EXISTS "Customer attachments delete access" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Allow authenticated users to view customer attachments
CREATE POLICY "Customer attachments read access" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'customer_attachments' AND
  (
    -- Owner can see their files
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Sub-users can see their board owner's files
    EXISTS (
      SELECT 1 FROM sub_users su
      WHERE su.board_owner_id::text = (storage.foldername(name))[1]
      AND su.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR
    -- Public board files are viewable
    (storage.foldername(name))[1] IN (
      SELECT pb.user_id::text FROM public_boards pb WHERE pb.is_active = true
    )
  )
);

-- Allow users to upload customer attachments
CREATE POLICY "Customer attachments upload access" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'customer_attachments' AND
  (
    -- Authenticated users can upload to their own folder
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Sub-users can upload to their board owner's folder
    EXISTS (
      SELECT 1 FROM sub_users su
      WHERE su.board_owner_id::text = (storage.foldername(name))[1]
      AND su.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR
    -- Allow uploads to public board owner folders (for external users)
    (storage.foldername(name))[1] IN (
      SELECT pb.user_id::text FROM public_boards pb WHERE pb.is_active = true
    )
  )
);

-- Allow users to update their customer attachments
CREATE POLICY "Customer attachments update access" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'customer_attachments' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM sub_users su
      WHERE su.board_owner_id::text = (storage.foldername(name))[1]
      AND su.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR
    (storage.foldername(name))[1] IN (
      SELECT pb.user_id::text FROM public_boards pb WHERE pb.is_active = true
    )
  )
);

-- Allow users to delete their customer attachments
CREATE POLICY "Customer attachments delete access" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'customer_attachments' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM sub_users su
      WHERE su.board_owner_id::text = (storage.foldername(name))[1]
      AND su.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR
    (storage.foldername(name))[1] IN (
      SELECT pb.user_id::text FROM public_boards pb WHERE pb.is_active = true
    )
  )
);