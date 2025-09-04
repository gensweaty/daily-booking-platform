-- Add edit/delete functionality to chat_messages table
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS original_content TEXT;

-- Create index for better performance on delete queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_deleted ON chat_messages(is_deleted);

-- Update RLS policies to ensure users can only edit/delete their own messages
CREATE POLICY "Users can update their own messages" ON chat_messages
FOR UPDATE USING (
  (sender_type = 'admin' AND sender_user_id = auth.uid()) OR
  (sender_type = 'sub_user' AND sender_sub_user_id IN (
    SELECT id FROM sub_users WHERE board_owner_id = auth.uid()
  ))
) WITH CHECK (
  (sender_type = 'admin' AND sender_user_id = auth.uid()) OR
  (sender_type = 'sub_user' AND sender_sub_user_id IN (
    SELECT id FROM sub_users WHERE board_owner_id = auth.uid()
  ))
);