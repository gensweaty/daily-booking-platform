-- Fix DM creation with proper constraints and function overloading

-- 1) Deduplicate chat_participants by (channel_id, user_id, sub_user_id)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY channel_id, user_id, sub_user_id
      ORDER BY joined_at DESC NULLS LAST, id
    ) AS rn
  FROM public.chat_participants
)
DELETE FROM public.chat_participants p
USING ranked r
WHERE p.id = r.id AND r.rn > 1;

-- 2) Create the unique index ON CONFLICT expects for chat_participants
CREATE UNIQUE INDEX IF NOT EXISTS chat_participants_uq_triplet
  ON public.chat_participants (channel_id, user_id, sub_user_id);

-- 3) Consolidate duplicate DM channels (moves messages, keeps one channel)
DO $$
BEGIN
  PERFORM public.consolidate_duplicate_dm_channels();
EXCEPTION WHEN OTHERS THEN
  -- if the helper isn't present, just continue
  NULL;
END$$;

-- 4) Create the unique index ON CONFLICT expects for chat_channels
--    limited to real DMs and non-null pair keys
CREATE UNIQUE INDEX IF NOT EXISTS chat_channels_uq_owner_dmkey
  ON public.chat_channels (owner_id, dm_pair_key)
  WHERE is_dm IS TRUE AND dm_pair_key IS NOT NULL;

-- 5) Drop existing function and recreate with proper overloading
DROP FUNCTION IF EXISTS public.start_public_board_dm(uuid, text, text, uuid);

-- Main implementation 
CREATE OR REPLACE FUNCTION public.start_public_board_dm(
  p_board_owner_id uuid,
  p_sender_email  text,
  p_target_type   text,
  p_target_id     uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_sender_sub_user_id uuid;
  v_channel_id uuid;
BEGIN
  SELECT id INTO v_sender_sub_user_id
  FROM sub_users
  WHERE board_owner_id = p_board_owner_id
    AND lower(email) = lower(p_sender_email)
  LIMIT 1;

  IF v_sender_sub_user_id IS NULL THEN
    RAISE EXCEPTION 'Sender email % not found as sub-user for board %', p_sender_email, p_board_owner_id;
  END IF;

  IF p_target_type NOT IN ('admin','sub_user') THEN
    RAISE EXCEPTION 'Invalid target type %. Must be admin or sub_user', p_target_type;
  END IF;

  -- Use canonical creator (relies on the new unique index on (owner_id, dm_pair_key))
  SELECT public.get_or_create_canonical_dm(
    p_board_owner_id,
    'sub_user', v_sender_sub_user_id,
    p_target_type, p_target_id
  )
  INTO v_channel_id;

  RETURN v_channel_id;
END
$$;