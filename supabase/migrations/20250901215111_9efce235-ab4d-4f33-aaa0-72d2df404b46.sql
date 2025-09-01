-- Fix storage bucket and RLS policies for chat_attachments
-- First ensure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_attachments', 'chat_attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create RLS policies for chat_attachments bucket to allow public uploads and access
CREATE POLICY "Public can upload chat attachments"
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'chat_attachments');

CREATE POLICY "Public can view chat attachments"
ON storage.objects FOR SELECT 
USING (bucket_id = 'chat_attachments');

CREATE POLICY "Public can delete chat attachments"
ON storage.objects FOR DELETE 
USING (bucket_id = 'chat_attachments');