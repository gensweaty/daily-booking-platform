-- Step 2: Create comprehensive RLS policies for chat_messages visibility
-- This ensures dashboard owners see all messages and participants see channel messages

-- Create comprehensive, optimized RLS policies for chat_messages
-- Policy 1: Dashboard owners can see ALL messages in channels they own
CREATE POLICY "dashboard_owners_see_all_messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    -- Owner of the channel can see all messages
    owner_id = auth.uid()
  );

-- Policy 2: Authenticated participants can see messages in their channels
CREATE POLICY "participants_see_channel_messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    -- User is explicitly a participant in this channel
    EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.channel_id = chat_messages.channel_id
        AND (
          cp.user_id = auth.uid() OR
          cp.sub_user_id IN (
            SELECT su.id
            FROM public.sub_users su
            WHERE su.board_owner_id = auth.uid()
          )
        )
    )
  );

-- Policy 3: Anonymous users can see messages in active public boards
CREATE POLICY "public_board_message_access"
  ON public.chat_messages
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_channels ch
      JOIN public.public_boards pb ON pb.user_id = ch.owner_id
      WHERE ch.id = chat_messages.channel_id
        AND pb.is_active = TRUE
    )
  );

-- Policy 4: Authenticated users can send messages to channels they participate in
CREATE POLICY "authenticated_users_can_send"
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin users can send to channels they own
    (sender_type = 'admin' AND sender_user_id = auth.uid() AND owner_id = auth.uid())
    OR
    -- Sub-users can send to channels where they are participants
    (sender_type = 'sub_user' AND EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.channel_id = chat_messages.channel_id
        AND cp.sub_user_id = chat_messages.sender_sub_user_id
        AND cp.user_type = 'sub_user'
    ))
  );

-- Policy 5: Service role can do everything (for edge functions)
CREATE POLICY "service_role_full_access"
  ON public.chat_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Safely add table to realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$$;

-- Add helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created 
  ON public.chat_messages (channel_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_owner_channel 
  ON public.chat_messages (owner_id, channel_id);