-- Minimal RLS for chat functionality
-- chat_channels: owner can read
CREATE POLICY "channels_read_owner"
ON chat_channels FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- chat_messages: participants can read/write  
CREATE POLICY "msgs_read"
ON chat_messages FOR SELECT
TO authenticated
USING (
  EXISTS(SELECT 1 FROM chat_channels c
         WHERE c.id = chat_messages.channel_id
           AND c.owner_id = auth.uid())
  OR sender_user_id = auth.uid()
);

CREATE POLICY "msgs_write" 
ON chat_messages FOR INSERT
TO authenticated
WITH CHECK (sender_user_id = auth.uid());