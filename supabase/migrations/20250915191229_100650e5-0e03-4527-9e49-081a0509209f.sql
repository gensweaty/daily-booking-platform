-- Create comprehensive storage policies for external users

-- Customer attachments policies
CREATE POLICY "Allow customer attachments upload" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'customer_attachments' AND 
  (
    -- Authenticated users can upload to their own files
    (auth.uid() IS NOT NULL AND auth.uid() = owner) OR
    -- Unauthenticated users can upload to public board owners' files
    (auth.uid() IS NULL AND owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    ))
  )
);

CREATE POLICY "Allow customer attachments view" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'customer_attachments' AND 
  (
    -- Authenticated users can view their own files
    (auth.uid() IS NOT NULL AND auth.uid() = owner) OR
    -- Anyone can view files owned by public board owners
    owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

CREATE POLICY "Allow customer attachments update" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'customer_attachments' AND 
  (
    -- Authenticated users can update their own files
    (auth.uid() IS NOT NULL AND auth.uid() = owner) OR
    -- Anyone can update files owned by public board owners (for file metadata)
    owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

CREATE POLICY "Allow customer attachments delete" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'customer_attachments' AND 
  (
    -- Authenticated users can delete their own files
    (auth.uid() IS NOT NULL AND auth.uid() = owner) OR
    -- Public board owners can delete files on their boards
    owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

-- Event attachments policies
CREATE POLICY "Allow event attachments upload" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'event_attachments' AND 
  (
    -- Authenticated users can upload to their own files
    (auth.uid() IS NOT NULL AND auth.uid() = owner) OR
    -- Unauthenticated users can upload to public board owners' files
    (auth.uid() IS NULL AND owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    ))
  )
);

CREATE POLICY "Allow event attachments view" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'event_attachments' AND 
  (
    -- Authenticated users can view their own files
    (auth.uid() IS NOT NULL AND auth.uid() = owner) OR
    -- Anyone can view files owned by public board owners
    owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

CREATE POLICY "Allow event attachments update" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'event_attachments' AND 
  (
    -- Authenticated users can update their own files
    (auth.uid() IS NOT NULL AND auth.uid() = owner) OR
    -- Anyone can update files owned by public board owners
    owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

CREATE POLICY "Allow event attachments delete" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'event_attachments' AND 
  (
    -- Authenticated users can delete their own files
    (auth.uid() IS NOT NULL AND auth.uid() = owner) OR
    -- Public board owners can delete files on their boards
    owner IN (
      SELECT user_id FROM public_boards WHERE is_active = true
    )
  )
);

-- General storage policy for other buckets (maintain existing functionality)
CREATE POLICY "Allow authenticated users general storage" 
ON storage.objects 
FOR ALL 
USING (
  bucket_id NOT IN ('customer_attachments', 'event_attachments') AND 
  auth.uid() IS NOT NULL AND 
  auth.uid() = owner
)
WITH CHECK (
  bucket_id NOT IN ('customer_attachments', 'event_attachments') AND 
  auth.uid() IS NOT NULL AND 
  auth.uid() = owner
);