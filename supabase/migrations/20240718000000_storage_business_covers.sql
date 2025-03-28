
-- Create storage bucket for business cover photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('business_covers', 'business_covers', true);

-- Allow public access to read business cover photos
CREATE POLICY "Public read access for business covers" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'business_covers');

-- Allow authenticated users to upload, update, and delete their own business covers
CREATE POLICY "Users can upload business covers" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'business_covers' AND
        auth.uid() = (storage.foldername(name))[1]::uuid
    );

CREATE POLICY "Users can update their own business covers" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'business_covers' AND
        auth.uid() = (storage.foldername(name))[1]::uuid
    );

CREATE POLICY "Users can delete their own business covers" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'business_covers' AND
        auth.uid() = (storage.foldername(name))[1]::uuid
    );
