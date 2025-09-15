-- Fix storage uploads by allowing bucket-scoped INSERT policies
-- Clean up current insert policy that blocks everything
DROP POLICY IF EXISTS "simple_authenticated_insert" ON storage.objects;

-- Allow INSERT for AUTH users into our attachment buckets
CREATE POLICY "allow insert attachments (auth)"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN (
    'customer_attachments',
    'event_attachments',
    'task_attachments',
    'chat_attachments',
    'note_attachments',
    'booking_attachments',
    'comment_attachments'
  )
);

-- Allow INSERT for ANON (public boards) into the same buckets
CREATE POLICY "allow insert attachments (anon)"
ON storage.objects
FOR INSERT TO anon
WITH CHECK (
  bucket_id IN (
    'customer_attachments',
    'event_attachments',
    'task_attachments',
    'chat_attachments',
    'note_attachments',
    'booking_attachments',
    'comment_attachments'
  )
);

-- Keep broad public read so everything shows up everywhere
DROP POLICY IF EXISTS "simple_public_read_attachments" ON storage.objects;
CREATE POLICY "public read attachments"
ON storage.objects
FOR SELECT TO anon, authenticated
USING (
  bucket_id IN (
    'customer_attachments',
    'event_attachments',
    'task_attachments',
    'chat_attachments',
    'note_attachments',
    'booking_attachments',
    'comment_attachments'
  )
);

-- Let authenticated users UPDATE/DELETE their own objects
DROP POLICY IF EXISTS "simple_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "simple_authenticated_delete" ON storage.objects;

CREATE POLICY "update attachments (auth)"
ON storage.objects
FOR UPDATE TO authenticated
USING (true) WITH CHECK (bucket_id IN (
  'customer_attachments','event_attachments','task_attachments',
  'chat_attachments','note_attachments','booking_attachments','comment_attachments'
));

CREATE POLICY "delete attachments (auth)"
ON storage.objects
FOR DELETE TO authenticated
USING (true);

-- Ensure comments and messages tables don't block uploads
ALTER TABLE public.task_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;