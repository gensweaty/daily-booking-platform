-- Fix AI channel isolation for both authenticated and public board users
-- Sub-users don't have auth.uid(), so we rely on application-level filtering by channel_id
-- while allowing RLS to be permissive for public board access

DROP POLICY IF EXISTS "ai_channel_strict_isolation" ON chat_messages;

CREATE POLICY "ai_channel_messages_access" ON chat_messages
FOR SELECT
USING (
  -- AI channels: special handling for both authenticated and public board users
  (
    EXISTS (
      SELECT 1 FROM chat_channels cc
      WHERE cc.id = chat_messages.channel_id
        AND cc.is_ai = true
        AND cc.is_deleted = false
        AND (
          -- Authenticated owner can see their AI messages
          cc.owner_id = auth.uid()
          -- Public board sub-users (no auth) can see AI messages for their board
          -- Application MUST filter by correct channel_id
          OR (
            auth.uid() IS NULL 
            AND cc.owner_id = chat_messages.owner_id
          )
        )
    )
  )
  OR
  -- Non-AI channels: existing permission logic
  (
    NOT EXISTS (
      SELECT 1 FROM chat_channels cc
      WHERE cc.id = chat_messages.channel_id AND cc.is_ai = true
    )
    AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM chat_participants cp
        WHERE cp.channel_id = chat_messages.channel_id
          AND (
            cp.user_id = auth.uid()
            OR cp.sub_user_id IN (
              SELECT su.id FROM sub_users su
              WHERE su.board_owner_id = auth.uid()
            )
          )
      )
    )
  )
);