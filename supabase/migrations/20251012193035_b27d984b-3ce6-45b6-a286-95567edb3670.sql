-- Make excel-reports bucket public for easier downloads without JWT issues
UPDATE storage.buckets 
SET public = true 
WHERE id = 'excel-reports';

-- Update RLS policies for public bucket access
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;

-- Create new policies for public excel-reports bucket
CREATE POLICY "excel_reports_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'excel-reports');

-- Service role can do everything (for edge functions)
CREATE POLICY "excel_reports_service_write"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'excel-reports');

CREATE POLICY "excel_reports_service_update"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'excel-reports');

CREATE POLICY "excel_reports_service_delete"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'excel-reports');