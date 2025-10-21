-- Fix AI channel message isolation for sub-users
-- The issue: Current policy checks if sub_user belongs to auth.uid() (board owner)
-- This allows admins to see all sub-users' AI messages, and breaks for public board sub-users
-- 
-- Solution: For AI channels, ONLY show messages if the user is a DIRECT participant of that specific channel

DROP POLICY IF EXISTS "ai_channel_message_isolation" ON chat_messages;

CREATE POLICY "ai_channel_strict_isolation"
ON chat_messages
FOR SELECT
USING (
  -- For AI channels: strict participant-only access
  (EXISTS (
    SELECT 1 
    FROM chat_channels cc
    JOIN chat_participants cp ON cp.channel_id = cc.id
    WHERE cc.id = chat_messages.channel_id
    AND cc.is_ai = true
    AND (
      -- Admin participants: must match auth.uid() exactly
      (cp.user_type = 'admin' AND cp.user_id = auth.uid())
      OR
      -- Sub-user participants: must match their specific sub_user_id
      -- This works because each sub-user gets their own AI channel with only their sub_user_id
      (cp.user_type = 'sub_user' AND EXISTS (
        SELECT 1 FROM sub_users su 
        WHERE su.id = cp.sub_user_id 
        AND su.board_owner_id = chat_messages.owner_id
        -- For authenticated users, check they own this sub-user
        AND (auth.uid() = su.board_owner_id OR auth.uid() IS NULL)
      ))
    )
  ))
  OR
  -- For non-AI channels: use existing access logic (owner or participant)
  (NOT EXISTS (
    SELECT 1 FROM chat_channels cc
    WHERE cc.id = chat_messages.channel_id AND cc.is_ai = true
  ) AND (
    owner_id = auth.uid() 
    OR 
    EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.channel_id = chat_messages.channel_id
      AND (
        cp.user_id = auth.uid() 
        OR 
        cp.sub_user_id IN (
          SELECT su.id FROM sub_users su WHERE su.board_owner_id = auth.uid()
        )
      )
    )
  ))
);