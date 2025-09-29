-- 20250929_fix_chat_core.sql
BEGIN;

------------------------------------------------------------
-- 1) De-dupe participants that may have been inserted
--    while the unique constraint was missing
------------------------------------------------------------
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY channel_id, user_id, sub_user_id
           ORDER BY id
         ) AS rn
  FROM public.chat_participants
)
DELETE FROM public.chat_participants
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

------------------------------------------------------------
-- 2) Ensure the unique constraint exists for ON CONFLICT
--    NOTE: it must match the columns used in your RPC:
--          (channel_id, user_id, sub_user_id)
------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_participants_unique_3col'
  ) THEN
    ALTER TABLE public.chat_participants
      ADD CONSTRAINT chat_participants_unique_3col
      UNIQUE (channel_id, user_id, sub_user_id);
  END IF;
END$$;

-- (Helpful index, no behavior change)
CREATE INDEX IF NOT EXISTS chat_participants_channel_idx
  ON public.chat_participants (channel_id);

------------------------------------------------------------
-- 3) Make sure the UI can call the RPCs it uses on load
--    (idempotent if already granted)
------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.list_channel_messages_public(uuid, uuid, text, text)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_chat_messages_for_channel(uuid, uuid)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.list_files_for_messages_public(uuid[])
  TO anon, authenticated;

-- These are also hit from the chat shell / init path
GRANT EXECUTE ON FUNCTION public.get_default_channel_for_board(uuid)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.find_or_create_dm(uuid, text, uuid, text, uuid)
  TO anon, authenticated;

-- Optional but recommended (used when reading/zeroing unreads, sending msgs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'mark_channel_read'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.mark_channel_read(uuid, text, uuid, uuid)
      TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'send_public_board_message') THEN
    GRANT EXECUTE ON FUNCTION public.send_public_board_message(uuid, uuid, text, text)
      TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'attach_files_to_message_public') THEN
    GRANT EXECUTE ON FUNCTION public.attach_files_to_message_public(uuid, uuid, text, jsonb)
      TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'attach_files_to_message_public_by_id') THEN
    GRANT EXECUTE ON FUNCTION public.attach_files_to_message_public_by_id(uuid, uuid, jsonb)
      TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'send_authenticated_message') THEN
    GRANT EXECUTE ON FUNCTION public.send_authenticated_message(uuid, uuid, text)
      TO anon, authenticated;
  END IF;
END$$;

COMMIT;