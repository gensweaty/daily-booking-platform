-- First, drop all existing chat policies to start fresh
DROP POLICY IF EXISTS "Users can view channels they own or participate in" ON chat_channels;
DROP POLICY IF EXISTS "Channel owners can update their channels" ON chat_channels;
DROP POLICY IF EXISTS "Channel owners can delete their channels" ON chat_channels;
DROP POLICY IF EXISTS "Users can create channels they own" ON chat_channels;

DROP POLICY IF EXISTS "Users can view participants in their own channels" ON chat_participants;
DROP POLICY IF EXISTS "Channel owners can manage participants" ON chat_participants;

DROP POLICY IF EXISTS "Users can send messages to channels they participate in" ON chat_messages;
DROP POLICY IF EXISTS "Users can view messages in their channels" ON chat_messages;

DROP POLICY IF EXISTS "Users can add reactions to messages in their channels" ON chat_message_reactions;
DROP POLICY IF EXISTS "Users can delete their own reactions" ON chat_message_reactions;
DROP POLICY IF EXISTS "Users can view reactions in their channels" ON chat_message_reactions;

DROP POLICY IF EXISTS "Users can upload files to messages in their channels" ON chat_message_files;
DROP POLICY IF EXISTS "Users can view files in their channels" ON chat_message_files;

-- Create simplified policies without recursion

-- Chat Channels: Only owners can see their channels
CREATE POLICY "Channel owners can view their channels" ON chat_channels
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Channel owners can manage their channels" ON chat_channels
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Chat Participants: Only channel owners can manage participants
CREATE POLICY "Channel owners can manage all participants" ON chat_participants
  FOR ALL
  USING (
    channel_id IN (
      SELECT id FROM chat_channels WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    channel_id IN (
      SELECT id FROM chat_channels WHERE owner_id = auth.uid()
    )
  );

-- Chat Messages: Simple policy based on channel ownership
CREATE POLICY "Users can view messages in owned channels" ON chat_messages
  FOR SELECT
  USING (
    channel_id IN (
      SELECT id FROM chat_channels WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to owned channels" ON chat_messages
  FOR INSERT
  WITH CHECK (
    channel_id IN (
      SELECT id FROM chat_channels WHERE owner_id = auth.uid()
    )
    AND (
      (sender_type = 'admin' AND sender_user_id = auth.uid())
      OR 
      (sender_type = 'sub_user' AND sender_sub_user_id IN (
        SELECT id FROM sub_users 
        WHERE board_owner_id = auth.uid()
        AND lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
      ))
    )
  );

-- Chat Message Reactions: Simple policy based on channel ownership
CREATE POLICY "Users can view reactions in owned channels" ON chat_message_reactions
  FOR SELECT
  USING (
    message_id IN (
      SELECT cm.id FROM chat_messages cm
      JOIN chat_channels cc ON cm.channel_id = cc.id
      WHERE cc.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can add reactions in owned channels" ON chat_message_reactions
  FOR INSERT
  WITH CHECK (
    message_id IN (
      SELECT cm.id FROM chat_messages cm
      JOIN chat_channels cc ON cm.channel_id = cc.id
      WHERE cc.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own reactions" ON chat_message_reactions
  FOR DELETE
  USING (
    (user_type = 'admin' AND user_id = auth.uid())
    OR 
    (user_type = 'sub_user' AND sub_user_id IN (
      SELECT id FROM sub_users 
      WHERE board_owner_id = auth.uid()
      AND lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    ))
  );

-- Chat Message Files: Simple policy based on channel ownership
CREATE POLICY "Users can view files in owned channels" ON chat_message_files
  FOR SELECT
  USING (
    message_id IN (
      SELECT cm.id FROM chat_messages cm
      JOIN chat_channels cc ON cm.channel_id = cc.id
      WHERE cc.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload files to owned channels" ON chat_message_files
  FOR INSERT
  WITH CHECK (
    message_id IN (
      SELECT cm.id FROM chat_messages cm
      JOIN chat_channels cc ON cm.channel_id = cc.id
      WHERE cc.owner_id = auth.uid()
    )
  );