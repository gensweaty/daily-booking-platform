-- Check if chat_attachments bucket exists and create RLS policies
DO $$
BEGIN
    -- Create chat_attachments bucket if it doesn't exist
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('chat_attachments', 'chat_attachments', true)
    ON CONFLICT (id) DO NOTHING;
END $$;

-- Create RLS policies for chat_attachments bucket to allow public access
CREATE POLICY "Allow public uploads to chat_attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'chat_attachments');

CREATE POLICY "Allow public reads from chat_attachments" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'chat_attachments');

CREATE POLICY "Allow public updates to chat_attachments" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'chat_attachments');

CREATE POLICY "Allow public deletes from chat_attachments" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'chat_attachments');