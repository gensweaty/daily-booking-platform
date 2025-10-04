-- Create chat_attachments storage bucket if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat_attachments', 'chat_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Add attachment-related columns to chat_messages table
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS has_attachments boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';

-- Create chat_message_files table to link messages with file attachments
CREATE TABLE IF NOT EXISTS chat_message_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    filename text NOT NULL,
    file_path text NOT NULL,
    content_type text,
    size bigint,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on chat_message_files if table was created
DO $$
BEGIN
    -- Only enable RLS if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'chat_message_files' AND relrowsecurity = true) THEN
        ALTER TABLE chat_message_files ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Participants can view message files" ON chat_message_files;
DROP POLICY IF EXISTS "Participants can manage message files" ON chat_message_files;

-- Create new policies
CREATE POLICY "Participants can view message files" ON chat_message_files
FOR SELECT USING (
  message_id IN (
    SELECT cm.id FROM chat_messages cm
    WHERE cm.channel_id IN (
      SELECT cp.channel_id FROM chat_participants cp
      WHERE (cp.user_id = auth.uid() OR cp.sub_user_id IN (
        SELECT su.id FROM sub_users su WHERE su.board_owner_id = auth.uid()
      ))
    )
  )
);

CREATE POLICY "Participants can manage message files" ON chat_message_files
FOR ALL USING (
  message_id IN (
    SELECT cm.id FROM chat_messages cm
    WHERE cm.channel_id IN (
      SELECT cp.channel_id FROM chat_participants cp
      WHERE (cp.user_id = auth.uid() OR cp.sub_user_id IN (
        SELECT su.id FROM sub_users su WHERE su.board_owner_id = auth.uid()
      ))
    )
  )
) WITH CHECK (
  message_id IN (
    SELECT cm.id FROM chat_messages cm
    WHERE cm.channel_id IN (
      SELECT cp.channel_id FROM chat_participants cp
      WHERE (cp.user_id = auth.uid() OR cp.sub_user_id IN (
        SELECT su.id FROM sub_users su WHERE su.board_owner_id = auth.uid()
      ))
    )
  )
);

-- Storage policies for chat_attachments bucket (drop and recreate)
DROP POLICY IF EXISTS "Chat participants can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their chat attachments" ON storage.objects;

CREATE POLICY "Chat participants can view attachments" ON storage.objects
FOR SELECT USING (
  bucket_id = 'chat_attachments'
);

CREATE POLICY "Authenticated users can upload chat attachments" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'chat_attachments' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their chat attachments" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'chat_attachments' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their chat attachments" ON storage.objects
FOR DELETE USING (
  bucket_id = 'chat_attachments' AND
  auth.uid() IS NOT NULL
);