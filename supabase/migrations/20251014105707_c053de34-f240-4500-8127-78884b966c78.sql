-- Step 1: Delete all old shared AI channels (created by the old ensure_ai_channel function)
-- These are AI channels that have multiple participants (shared workspace-wide)
DELETE FROM chat_channels 
WHERE is_ai = true 
AND id IN (
  SELECT channel_id 
  FROM chat_participants 
  GROUP BY channel_id 
  HAVING COUNT(*) > 1
);

-- Step 2: Update the RLS policy for chat_messages to ensure users only see their own AI messages
DROP POLICY IF EXISTS "ai_channel_message_isolation" ON chat_messages;
CREATE POLICY "ai_channel_message_isolation" 
ON chat_messages 
FOR SELECT
USING (
  -- For AI channels, only show messages where the user is a participant
  (EXISTS (
    SELECT 1 FROM chat_channels cc
    JOIN chat_participants cp ON cp.channel_id = cc.id
    WHERE cc.id = chat_messages.channel_id
    AND cc.is_ai = true
    AND (
      (cp.user_type = 'admin' AND cp.user_id = auth.uid()) OR
      (cp.user_type = 'sub_user' AND cp.sub_user_id IN (
        SELECT id FROM sub_users WHERE board_owner_id = auth.uid()
      ))
    )
  ))
  OR
  -- For non-AI channels, use existing logic
  (EXISTS (
    SELECT 1 FROM chat_channels cc
    WHERE cc.id = chat_messages.channel_id
    AND cc.is_ai = false
  ) AND (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.channel_id = chat_messages.channel_id
      AND ((cp.user_id = auth.uid()) OR (cp.sub_user_id IN (
        SELECT su.id FROM sub_users su WHERE su.board_owner_id = auth.uid()
      )))
    )
  ))
);