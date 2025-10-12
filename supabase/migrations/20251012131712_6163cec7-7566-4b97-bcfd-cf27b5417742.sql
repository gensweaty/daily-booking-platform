-- Create excel-reports storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'excel-reports',
  'excel-reports',
  false,
  52428800, -- 50MB limit
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own reports
CREATE POLICY "Users can upload their own Excel reports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'excel-reports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own reports
CREATE POLICY "Users can read their own Excel reports"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'excel-reports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own old reports
CREATE POLICY "Users can delete their own Excel reports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'excel-reports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);