
-- Create the booking_files table to track files attached to booking requests
CREATE TABLE IF NOT EXISTS public.booking_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id UUID REFERENCES public.booking_requests(id),
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_type TEXT,
  size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add policies for booking_files
ALTER TABLE public.booking_files ENABLE ROW LEVEL SECURITY;

-- Anyone can see booking files (needed for public booking forms)
CREATE POLICY "Anyone can select booking files" 
ON public.booking_files FOR SELECT USING (true);

-- Anyone can insert booking files (needed for public booking forms)
CREATE POLICY "Anyone can insert booking files" 
ON public.booking_files FOR INSERT WITH CHECK (true);

-- Business owner can update their own booking files
CREATE POLICY "Business owners can update booking files" 
ON public.booking_files FOR UPDATE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM booking_requests br 
    WHERE br.id = booking_request_id 
    AND br.business_id IN (
      SELECT id FROM business_profiles 
      WHERE user_id = auth.uid()
    )
  )
);

-- Business owner can delete their own booking files
CREATE POLICY "Business owners can delete booking files" 
ON public.booking_files FOR DELETE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM booking_requests br 
    WHERE br.id = booking_request_id 
    AND br.business_id IN (
      SELECT id FROM business_profiles 
      WHERE user_id = auth.uid()
    )
  )
);

-- Ensure storage buckets exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('booking_attachments', 'booking_attachments', true, 52428800, '{"image/*", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"}')
ON CONFLICT (id) DO NOTHING;

-- Set storage policies for booking_attachments
CREATE POLICY "Public Access for booking_attachments"
ON storage.objects FOR SELECT
USING ( bucket_id = 'booking_attachments' );

CREATE POLICY "Anyone can upload to booking_attachments"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'booking_attachments' );

CREATE POLICY "Business owners can update their booking attachments"
ON storage.objects FOR UPDATE
USING ( 
  bucket_id = 'booking_attachments' AND 
  EXISTS (
    SELECT 1 FROM booking_files bf 
    JOIN booking_requests br ON bf.booking_request_id = br.id
    JOIN business_profiles bp ON br.business_id = bp.id
    WHERE storage.foldername(name) || '/' || storage.filename(name) = bf.file_path
    AND bp.user_id = auth.uid()
  )
);

CREATE POLICY "Business owners can delete their booking attachments"
ON storage.objects FOR DELETE
USING ( 
  bucket_id = 'booking_attachments' AND 
  EXISTS (
    SELECT 1 FROM booking_files bf 
    JOIN booking_requests br ON bf.booking_request_id = br.id
    JOIN business_profiles bp ON br.business_id = bp.id
    WHERE storage.foldername(name) || '/' || storage.filename(name) = bf.file_path
    AND bp.user_id = auth.uid()
  )
);
