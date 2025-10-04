-- Fix RLS policies for sub-users on public boards to see and send messages

-- Update chat_messages read policy to handle sub-users properly
DROP POLICY IF EXISTS "Participants can view messages in their channels" ON chat_messages;
DROP POLICY IF EXISTS "read chat messages for workspace" ON chat_messages;

-- Create comprehensive read policy for chat messages
CREATE POLICY "Enhanced participants can view messages" 
ON chat_messages FOR SELECT 
USING (
  -- Board owners can see all messages in their channels
  (owner_id = auth.uid()) OR 
  
  -- Authenticated users can see messages in channels they participate in
  (auth.uid() IS NOT NULL AND channel_id IN (
    SELECT cp.channel_id
    FROM chat_participants cp
    WHERE (cp.user_id = auth.uid()) OR 
          (cp.sub_user_id IN (
            SELECT su.id
            FROM sub_users su
            WHERE su.board_owner_id = auth.uid()
          ))
  )) OR
  
  -- Sub-users can see messages in channels for their board (even without auth.uid)
  (EXISTS (
    SELECT 1 
    FROM chat_channels cc
    JOIN public_boards pb ON cc.owner_id = pb.user_id
    WHERE cc.id = chat_messages.channel_id 
    AND pb.is_active = true
  )) OR
  
  -- Messages in channels where sub-users participate (fallback for public board access)
  (channel_id IN (
    SELECT cp.channel_id
    FROM chat_participants cp
    WHERE cp.user_type = 'sub_user'
  ))
);

-- Update chat_messages insert policy to handle sub-users properly  
DROP POLICY IF EXISTS "Participants can send messages in their channels" ON chat_messages;
DROP POLICY IF EXISTS "msgs_write" ON chat_messages;

-- Create comprehensive write policy for chat messages
CREATE POLICY "Enhanced participants can send messages"
ON chat_messages FOR INSERT
WITH CHECK (
  -- Admin users can send messages in their channels
  ((sender_user_id = auth.uid()) AND (sender_type = 'admin')) OR
  
  -- Sub-users can send messages if they're participants in the channel
  ((sender_type = 'sub_user') AND (channel_id IN (
    SELECT cp.channel_id
    FROM chat_participants cp
    WHERE (cp.sub_user_id = chat_messages.sender_sub_user_id) AND 
          (cp.user_type = 'sub_user')
  ))) OR
  
  -- Board owners can send any message in their channels
  (owner_id = auth.uid()) OR
  
  -- Allow sending in channels for active public boards (fallback)
  (EXISTS (
    SELECT 1 
    FROM chat_channels cc
    JOIN public_boards pb ON cc.owner_id = pb.user_id
    WHERE cc.id = chat_messages.channel_id 
    AND pb.is_active = true
  ))
);

-- Update chat_participants read policy
DROP POLICY IF EXISTS "Owners can manage participants in their channels" ON chat_participants;

-- Enhanced read policy for chat_participants
CREATE POLICY "Enhanced read participants"
ON chat_participants FOR SELECT
USING (
  -- Channel owners can see all participants
  (channel_id IN (
    SELECT cc.id
    FROM chat_channels cc
    WHERE cc.owner_id = auth.uid()
  )) OR
  
  -- Users can see participants in channels they're part of
  (auth.uid() IS NOT NULL AND (
    (user_id = auth.uid()) OR
    (sub_user_id IN (
      SELECT su.id
      FROM sub_users su
      WHERE su.board_owner_id = auth.uid()
    ))
  )) OR
  
  -- Allow reading participants for public boards (needed for team member display)
  (channel_id IN (
    SELECT cc.id
    FROM chat_channels cc
    JOIN public_boards pb ON cc.owner_id = pb.user_id
    WHERE pb.is_active = true
  ))
);

-- Enhanced write policy for chat_participants  
CREATE POLICY "Enhanced write participants"
ON chat_participants FOR INSERT
WITH CHECK (
  -- Channel owners can add participants
  (channel_id IN (
    SELECT cc.id
    FROM chat_channels cc
    WHERE cc.owner_id = auth.uid()
  )) OR
  
  -- Allow adding participants to public board channels
  (channel_id IN (
    SELECT cc.id
    FROM chat_channels cc
    JOIN public_boards pb ON cc.owner_id = pb.user_id
    WHERE pb.is_active = true
  ))
);

-- Enhanced delete policy for chat_participants
CREATE POLICY "Enhanced delete participants"
ON chat_participants FOR DELETE
USING (
  -- Channel owners can remove participants
  (channel_id IN (
    SELECT cc.id
    FROM chat_channels cc
    WHERE cc.owner_id = auth.uid()
  ))
);

-- Enhanced update policy for chat_participants
CREATE POLICY "Enhanced update participants"
ON chat_participants FOR UPDATE
USING (
  -- Channel owners can update participants
  (channel_id IN (
    SELECT cc.id
    FROM chat_channels cc
    WHERE cc.owner_id = auth.uid()
  ))
);