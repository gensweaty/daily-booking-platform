-- Drop existing policies for excel-reports bucket if any exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can upload their own Excel reports" ON storage.objects;
  DROP POLICY IF EXISTS "Users can read their own Excel reports" ON storage.objects;
  DROP POLICY IF EXISTS "Service role has full access to excel-reports" ON storage.objects;
  DROP POLICY IF EXISTS "excel_reports_service_all" ON storage.objects;
  DROP POLICY IF EXISTS "excel_reports_authenticated_select" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create policies for excel-reports bucket
-- Service role needs full access to upload and create signed URLs
CREATE POLICY "excel_reports_service_all"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'excel-reports')
WITH CHECK (bucket_id = 'excel-reports');

-- Authenticated users can read their own reports (for direct access if needed)
CREATE POLICY "excel_reports_authenticated_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'excel-reports' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);