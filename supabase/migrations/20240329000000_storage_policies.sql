
-- Create policies for note_attachments bucket
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'note_attachments');

CREATE POLICY "Allow users to update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'note_attachments' AND auth.uid() = owner);

CREATE POLICY "Allow users to delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'note_attachments' AND auth.uid() = owner);

CREATE POLICY "Allow users to read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'note_attachments' AND auth.uid() = owner);

-- Create policies for business_photos bucket
CREATE POLICY "Allow authenticated users to upload business photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'business_photos');

CREATE POLICY "Allow users to update their own business photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'business_photos' AND auth.uid() = owner);

CREATE POLICY "Allow users to delete their own business photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'business_photos' AND auth.uid() = owner);

CREATE POLICY "Allow users to read their business photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'business_photos' AND auth.uid() = owner);
