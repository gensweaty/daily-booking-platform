-- Add storage policies using proper Supabase syntax
-- Allow anonymous access to view files in customer_attachments bucket

CREATE POLICY "Allow public read access to customer attachments"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'customer_attachments');

-- Allow anonymous access to view files in event_attachments bucket  
CREATE POLICY "Allow public read access to event attachments"
ON storage.objects
FOR SELECT  
TO anon
USING (bucket_id = 'event_attachments');