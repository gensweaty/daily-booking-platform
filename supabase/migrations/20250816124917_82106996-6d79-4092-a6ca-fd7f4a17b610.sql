-- Temporarily drop all chat policies to allow initial data creation
DROP POLICY IF EXISTS "Channel owners can view their channels" ON chat_channels;
DROP POLICY IF EXISTS "Channel owners can manage their channels" ON chat_channels;
DROP POLICY IF EXISTS "Channel owners can manage all participants" ON chat_participants;
DROP POLICY IF EXISTS "Users can view messages in owned channels" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages to owned channels" ON chat_messages;
DROP POLICY IF EXISTS "Users can view reactions in owned channels" ON chat_message_reactions;
DROP POLICY IF EXISTS "Users can add reactions in owned channels" ON chat_message_reactions;
DROP POLICY IF EXISTS "Users can delete their own reactions" ON chat_message_reactions;
DROP POLICY IF EXISTS "Users can view files in owned channels" ON chat_message_files;
DROP POLICY IF EXISTS "Users can upload files to owned channels" ON chat_message_files;

-- Create super simple policies that can't cause recursion

-- Chat Channels - only owner can access
CREATE POLICY "simple_channels_policy" ON chat_channels
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Chat Participants - only channel owners
CREATE POLICY "simple_participants_policy" ON chat_participants  
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM chat_channels 
    WHERE chat_channels.id = chat_participants.channel_id 
    AND chat_channels.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_channels 
    WHERE chat_channels.id = chat_participants.channel_id 
    AND chat_channels.owner_id = auth.uid()
  ));

-- Chat Messages - only channel owners  
CREATE POLICY "simple_messages_policy" ON chat_messages
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM chat_channels 
    WHERE chat_channels.id = chat_messages.channel_id 
    AND chat_channels.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_channels 
    WHERE chat_channels.id = chat_messages.channel_id 
    AND chat_channels.owner_id = auth.uid()
  ));

-- Chat Reactions - only channel owners
CREATE POLICY "simple_reactions_policy" ON chat_message_reactions
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM chat_messages cm
    JOIN chat_channels cc ON cm.channel_id = cc.id
    WHERE cm.id = chat_message_reactions.message_id
    AND cc.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_messages cm
    JOIN chat_channels cc ON cm.channel_id = cc.id
    WHERE cm.id = chat_message_reactions.message_id
    AND cc.owner_id = auth.uid()
  ));

-- Chat Files - only channel owners
CREATE POLICY "simple_files_policy" ON chat_message_files
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM chat_messages cm
    JOIN chat_channels cc ON cm.channel_id = cc.id
    WHERE cm.id = chat_message_files.message_id
    AND cc.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_messages cm
    JOIN chat_channels cc ON cm.channel_id = cc.id
    WHERE cm.id = chat_message_files.message_id
    AND cc.owner_id = auth.uid()
  ));