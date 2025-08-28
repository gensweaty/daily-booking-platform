-- Fix chat message visibility with channel-based policies
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Clean up any prior read policies to avoid overlap
DROP POLICY IF EXISTS "Enhanced participants can view messages" ON public.chat_messages;
DROP POLICY IF EXISTS "anon can read messages for active public boards" ON public.chat_messages;
DROP POLICY IF EXISTS "msgs_read" ON public.chat_messages;
DROP POLICY IF EXISTS "read: owner or participant or public" ON public.chat_messages;

-- Authenticated: owner of the channel OR explicit participant
CREATE POLICY "read:owner_and_participants"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (
    -- Owner of the channel
    EXISTS (
      SELECT 1
      FROM public.chat_channels ch
      WHERE ch.id = chat_messages.channel_id
        AND ch.owner_id = auth.uid()
    )
    OR
    -- User is a participant in this channel
    EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.channel_id = chat_messages.channel_id
        AND cp.user_id = auth.uid()
    )
    OR
    -- Owner reading channels where their sub-users are participants (DMs etc.)
    EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      JOIN public.sub_users su ON su.id = cp.sub_user_id
      WHERE cp.channel_id = chat_messages.channel_id
        AND su.board_owner_id = auth.uid()
    )
  );

-- Anonymous viewers: only when the owner's public board is active
CREATE POLICY "read:anon_public_board"
  ON public.chat_messages
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_channels ch
      JOIN public.public_boards pb
        ON pb.user_id = ch.owner_id
       AND pb.is_active = TRUE
      WHERE ch.id = chat_messages.channel_id
    )
  );

-- Make sure Realtime includes the table
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN
  -- Table already in publication, ignore
  NULL;
END $$;

GRANT SELECT ON public.chat_messages TO anon, authenticated;