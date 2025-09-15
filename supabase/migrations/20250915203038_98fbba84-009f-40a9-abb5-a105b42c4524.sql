-- Fix the INSERT policy for customer_files_new to properly handle unauthenticated public board users
DROP POLICY IF EXISTS "customer_files_insert_policy" ON public.customer_files_new;

-- Create a new INSERT policy that handles both authenticated and unauthenticated users properly
CREATE POLICY "customer_files_insert_policy" ON public.customer_files_new
FOR INSERT
WITH CHECK (
  -- For authenticated users: allow uploading their own files
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) 
  OR 
  -- For authenticated sub-users: allow uploading files for their board owner
  (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM profiles p
    JOIN sub_users su ON (lower(su.email) = lower(p.username))
    WHERE p.id = auth.uid() AND su.board_owner_id = customer_files_new.user_id
  ))
  OR
  -- For unauthenticated public board users: allow uploads if user_id belongs to active public board
  (auth.uid() IS NULL AND user_id IN (
    SELECT public_boards.user_id
    FROM public_boards
    WHERE public_boards.is_active = true
  ))
);

-- Also fix the storage policies to handle unauthenticated users
DROP POLICY IF EXISTS "Customer attachments upload access" ON storage.objects;

-- Create new upload policy that handles unauthenticated public board users
CREATE POLICY "Customer attachments upload access" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'customer_attachments' AND
  (
    -- Authenticated users can upload to their own folder
    (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
    OR
    -- Sub-users can upload to their board owner's folder (when authenticated)
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM sub_users su
      WHERE su.board_owner_id::text = (storage.foldername(name))[1]
      AND su.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ))
    OR
    -- Unauthenticated users can upload to public board owner folders
    (auth.uid() IS NULL AND (storage.foldername(name))[1] IN (
      SELECT pb.user_id::text FROM public_boards pb WHERE pb.is_active = true
    ))
  )
);

-- Fix the read policy too
DROP POLICY IF EXISTS "Customer attachments read access" ON storage.objects;

-- Create new read policy that handles unauthenticated public board users
CREATE POLICY "Customer attachments read access" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'customer_attachments' AND
  (
    -- Authenticated: Owner can see their files
    (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
    OR
    -- Authenticated: Sub-users can see their board owner's files
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM sub_users su
      WHERE su.board_owner_id::text = (storage.foldername(name))[1]
      AND su.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ))
    OR
    -- Unauthenticated: Public board files are viewable
    (auth.uid() IS NULL AND (storage.foldername(name))[1] IN (
      SELECT pb.user_id::text FROM public_boards pb WHERE pb.is_active = true
    ))
    OR
    -- Anyone can view files from active public boards (for mixed auth contexts)
    ((storage.foldername(name))[1] IN (
      SELECT pb.user_id::text FROM public_boards pb WHERE pb.is_active = true
    ))
  )
);