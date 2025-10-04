-- Replace the read policy with a channel-ownership based rule
DROP POLICY IF EXISTS "Enhanced participants can view messages" ON public.chat_messages;

CREATE POLICY "read: owner or participant or public"
  ON public.chat_messages
  FOR SELECT
  USING (
    -- 1) Owner: any message in a channel they own
    EXISTS (
      SELECT 1
      FROM public.chat_channels ch
      WHERE ch.id = chat_messages.channel_id
        AND ch.owner_id = auth.uid()
    )
    OR
    -- 2) Authenticated participants in the channel
    EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.channel_id = chat_messages.channel_id
        AND (
          cp.user_id = auth.uid()
          OR cp.sub_user_id IN (
            SELECT su.id FROM public.sub_users su
            WHERE su.board_owner_id = auth.uid()
          )
        )
    )
    OR
    -- 3) Public boards (anon can read for realtime on public page)
    EXISTS (
      SELECT 1
      FROM public.chat_channels cc
      JOIN public.public_boards pb
        ON pb.user_id = cc.owner_id
      WHERE cc.id = chat_messages.channel_id
        AND pb.is_active = TRUE
    )
  );

-- Ensure realtime publication has the table (remove IF NOT EXISTS)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN
  -- Table already in publication, ignore
  NULL;
END $$;

-- Optional but recommended: normalize old data so future policies can be simpler
UPDATE public.chat_messages m
SET owner_id = ch.owner_id
FROM public.chat_channels ch
WHERE ch.id = m.channel_id
  AND (m.owner_id IS DISTINCT FROM ch.owner_id);