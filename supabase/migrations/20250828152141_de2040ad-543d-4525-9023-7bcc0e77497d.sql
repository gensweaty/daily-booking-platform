-- Allow anon users to read messages for active public boards

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_messages'
      AND policyname = 'anon can read messages for active public boards'
  ) THEN
    CREATE POLICY "anon can read messages for active public boards"
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
  END IF;
END$$;

GRANT SELECT ON TABLE public.chat_messages TO anon;