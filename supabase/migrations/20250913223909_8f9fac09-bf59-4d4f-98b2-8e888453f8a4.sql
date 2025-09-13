-- Add avatar_url column to chat_channels table
ALTER TABLE chat_channels ADD COLUMN avatar_url TEXT;

-- Create chat-avatars storage bucket for custom chat avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-avatars', 'chat-avatars', true);

-- Create storage policies for chat-avatars bucket
CREATE POLICY "Chat avatar images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'chat-avatars');

CREATE POLICY "Users can upload chat avatars" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'chat-avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update chat avatars" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'chat-avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete chat avatars" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'chat-avatars' AND auth.uid() IS NOT NULL);