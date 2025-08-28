-- Fix RLS policies for consistent message visibility across dashboard and public boards

-- Drop conflicting policies that might be causing inconsistent message visibility
DROP POLICY IF EXISTS "msgs_read" ON public.chat_messages;

-- Ensure the main policy allows dashboard owners to see all messages in their channels
-- and handles both authenticated and public board scenarios consistently
DROP POLICY IF EXISTS "Enhanced participants can view messages" ON public.chat_messages;

CREATE POLICY "Enhanced participants can view messages"
  ON public.chat_messages
  FOR SELECT
  USING (
    -- Dashboard owners can always see messages in channels they own
    (owner_id = auth.uid()) 
    OR 
    -- Authenticated participants can see messages in channels they participate in
    ((auth.uid() IS NOT NULL) AND (channel_id IN (
      SELECT cp.channel_id
      FROM chat_participants cp
      WHERE (cp.user_id = auth.uid()) 
         OR (cp.sub_user_id IN (
           SELECT su.id
           FROM sub_users su
           WHERE su.board_owner_id = auth.uid()
         ))
    )))
    OR
    -- Public board access (for anon users)
    (EXISTS (
      SELECT 1
      FROM chat_channels cc
      JOIN public_boards pb ON cc.owner_id = pb.user_id
      WHERE cc.id = chat_messages.channel_id 
        AND pb.is_active = true
    ))
  );