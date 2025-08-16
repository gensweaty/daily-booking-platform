-- Fix infinite recursion in chat_participants policies
DROP POLICY IF EXISTS "Users can view participants in their channels" ON chat_participants;
DROP POLICY IF EXISTS "Channel owners can manage participants" ON chat_participants;

-- Create corrected policies for chat_participants
CREATE POLICY "Channel owners can manage participants" ON chat_participants
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

CREATE POLICY "Users can view participants in their own channels" ON chat_participants
  FOR SELECT
  USING (
    -- Channel owner can see all participants
    channel_id IN (SELECT id FROM chat_channels WHERE owner_id = auth.uid())
    OR
    -- Admin users can see participants in channels they're part of
    (user_type = 'admin' AND user_id = auth.uid())
    OR
    -- Sub-users can see participants in channels they're part of
    (user_type = 'sub_user' AND sub_user_id IN (
      SELECT id FROM sub_users 
      WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    ))
  );

-- Fix the chat_channels policy to avoid circular reference
DROP POLICY IF EXISTS "Users can view channels they own or participate in" ON chat_channels;

CREATE POLICY "Users can view channels they own or participate in" ON chat_channels
  FOR SELECT
  USING (
    -- Channel owner can see their channels
    owner_id = auth.uid()
    OR
    -- Participants can see channels they're part of (simplified)
    EXISTS (
      SELECT 1 FROM chat_participants cp 
      WHERE cp.channel_id = chat_channels.id 
      AND (
        (cp.user_type = 'admin' AND cp.user_id = auth.uid())
        OR
        (cp.user_type = 'sub_user' AND cp.sub_user_id IN (
          SELECT su.id FROM sub_users su 
          WHERE lower(su.email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
        ))
      )
    )
  );