
CREATE POLICY "Users upload own screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own screenshots"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
