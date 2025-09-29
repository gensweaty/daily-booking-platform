-- 20250929_fix_public_board_dm_paths_corrected.sql
BEGIN;

--------------------------------------------------------------------
-- A) Unique constraint for chat_channels used by DM upsert
--------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_channels_owner_isdm_dmkey_uniq'
  ) THEN
    ALTER TABLE public.chat_channels
      ADD CONSTRAINT chat_channels_owner_isdm_dmkey_uniq
      UNIQUE (owner_id, is_dm, dm_pair_key);
  END IF;
END$$;

-- Helpful index (no behavior change)
CREATE INDEX IF NOT EXISTS chat_channels_owner_isdm_dmkey_idx
  ON public.chat_channels (owner_id, is_dm, dm_pair_key);

--------------------------------------------------------------------
-- B) Ensure BOTH participant conflict targets exist
--------------------------------------------------------------------
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_participants_unique_4col'
  ) THEN
    ALTER TABLE public.chat_participants
      ADD CONSTRAINT chat_participants_unique_4col
      UNIQUE (channel_id, user_type, user_id, sub_user_id);
  END IF;
END$$;

-- De-dupe any rows violating either key
WITH dupe3 AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY channel_id, user_id, sub_user_id
           ORDER BY id
         ) rn
  FROM public.chat_participants
),
dupe4 AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY channel_id, user_type, user_id, sub_user_id
           ORDER BY id
         ) rn
  FROM public.chat_participants
)
DELETE FROM public.chat_participants
WHERE id IN (
  SELECT id FROM dupe3 WHERE rn > 1
  UNION
  SELECT id FROM dupe4 WHERE rn > 1
);

--------------------------------------------------------------------
-- C) Fix the function ACTUALLY used on the public board:
--    Drop and recreate ensure_dm_channel to avoid parameter conflicts
--------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.ensure_dm_channel(uuid, text, uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.ensure_dm_channel(
  p_board_owner_id uuid,
  p_a_type   text, p_a_id uuid,
  p_b_type   text, p_b_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o record;
  v_key text;
  v_channel uuid;
BEGIN
  -- stable, ordered pair + key
  SELECT * INTO o FROM dm_order_pair(p_a_type, p_a_id, p_b_type, p_b_id);
  v_key := make_dm_pair_key(p_a_type, p_a_id, p_b_type, p_b_id);

  -- try existing
  SELECT id INTO v_channel
  FROM public.chat_channels
  WHERE owner_id = p_board_owner_id
    AND is_dm    = true
    AND dm_pair_key = v_key
  LIMIT 1;

  IF v_channel IS NULL THEN
    -- create channel; ON CONFLICT hits the named constraint
    INSERT INTO public.chat_channels (owner_id, name, is_dm, is_private, dm_pair_key)
    VALUES (p_board_owner_id, 'Direct Message', true, true, v_key)
    ON CONFLICT ON CONSTRAINT chat_channels_owner_isdm_dmkey_uniq DO NOTHING
    RETURNING id INTO v_channel;

    IF v_channel IS NULL THEN
      -- someone else created it concurrently – fetch id
      SELECT id INTO v_channel
      FROM public.chat_channels
      WHERE owner_id = p_board_owner_id
        AND is_dm    = true
        AND dm_pair_key = v_key
      LIMIT 1;
    END IF;

    -- add both participants; target the 4-col named constraint
    INSERT INTO public.chat_participants (channel_id, user_type, user_id, sub_user_id) VALUES
      (v_channel, o.left_type,
        CASE WHEN o.left_type  = 'admin'    THEN o.left_id  END,
        CASE WHEN o.left_type  = 'sub_user' THEN o.left_id  END),
      (v_channel, o.right_type,
        CASE WHEN o.right_type = 'admin'    THEN o.right_id END,
        CASE WHEN o.right_type = 'sub_user' THEN o.right_id END)
    ON CONFLICT ON CONSTRAINT chat_participants_unique_4col DO NOTHING;
  END IF;

  RETURN v_channel;
END;
$$;

-- Also update find_or_create_dm to use named constraints
CREATE OR REPLACE FUNCTION public.find_or_create_dm(
  p_owner_id uuid, p_a_type text, p_a_id uuid, p_b_type text, p_b_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  o record;
  v_key text;
  v_channel uuid;
BEGIN
  SELECT * INTO o FROM dm_order_pair(p_a_type, p_a_id, p_b_type, p_b_id);
  v_key := make_dm_pair_key(p_a_type, p_a_id, p_b_type, p_b_id);

  SELECT id INTO v_channel
  FROM public.chat_channels
  WHERE owner_id = p_owner_id
    AND is_dm    = true
    AND dm_pair_key = v_key
  LIMIT 1;

  IF v_channel IS NOT NULL THEN
    RETURN v_channel;
  END IF;

  INSERT INTO public.chat_channels (owner_id, name, is_dm, is_private, dm_pair_key)
  VALUES (p_owner_id, 'Direct Message', true, true, v_key)
  ON CONFLICT ON CONSTRAINT chat_channels_owner_isdm_dmkey_uniq DO NOTHING
  RETURNING id INTO v_channel;

  IF v_channel IS NULL THEN
    SELECT id INTO v_channel
    FROM public.chat_channels
    WHERE owner_id = p_owner_id
      AND is_dm    = true
      AND dm_pair_key = v_key
    LIMIT 1;
  END IF;

  INSERT INTO public.chat_participants (channel_id, user_type, user_id, sub_user_id) VALUES
    (v_channel, o.left_type,
      CASE WHEN o.left_type  = 'admin'    THEN o.left_id  END,
      CASE WHEN o.left_type  = 'sub_user' THEN o.left_id  END),
    (v_channel, o.right_type,
      CASE WHEN o.right_type = 'admin'    THEN o.right_id END,
      CASE WHEN o.right_type = 'sub_user' THEN o.right_id END)
  ON CONFLICT ON CONSTRAINT chat_participants_unique_4col DO NOTHING;

  RETURN v_channel;
END;
$func$;

-- Permissions for public-board usage
GRANT EXECUTE ON FUNCTION public.ensure_dm_channel(uuid, text, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_dm(uuid, text, uuid, text, uuid) TO anon, authenticated;

COMMIT;