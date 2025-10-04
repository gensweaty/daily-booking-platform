-- Fix customer_attachments storage policies to allow public access

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow authenticated users to upload customer files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view customer files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete customer files" ON storage.objects;

-- Create new policies that allow both authenticated and anonymous users
CREATE POLICY "Allow public access to upload customer files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'customer_attachments');

CREATE POLICY "Allow public access to view customer files" ON storage.objects
  FOR SELECT USING (bucket_id = 'customer_attachments');

CREATE POLICY "Allow public access to delete customer files" ON storage.objects
  FOR DELETE USING (bucket_id = 'customer_attachments');