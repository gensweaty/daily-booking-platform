-- 20250929_fix_public_dm_and_grants.sql
BEGIN;

-- 1) Remove exact duplicates under both candidate keys
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

-- 2) Ensure BOTH unique constraints exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_participants_unique_3col'
  ) THEN
    ALTER TABLE public.chat_participants
      ADD CONSTRAINT chat_participants_unique_3col
      UNIQUE (channel_id, user_id, sub_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_participants_unique_4col'
  ) THEN
    ALTER TABLE public.chat_participants
      ADD CONSTRAINT chat_participants_unique_4col
      UNIQUE (channel_id, user_type, user_id, sub_user_id);
  END IF;
END$$;

-- 3) Make the DM RPC explicitly target the 4-col constraint by NAME
CREATE OR REPLACE FUNCTION public.find_or_create_dm(
  p_owner_id uuid, p_a_type text, p_a_id uuid, p_b_type text, p_b_id uuid
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
  SELECT * INTO o FROM dm_order_pair(p_a_type, p_a_id, p_b_type, p_b_id);
  v_key := make_dm_pair_key(p_a_type, p_a_id, p_b_type, p_b_id);

  SELECT id INTO v_channel
  FROM chat_channels
  WHERE owner_id = p_owner_id
    AND is_dm = true
    AND dm_pair_key = v_key
  LIMIT 1;

  IF v_channel IS NOT NULL THEN
    RETURN v_channel;
  END IF;

  INSERT INTO chat_channels (owner_id, name, is_dm, is_private, dm_pair_key)
  VALUES (p_owner_id, 'Direct Message', true, true, v_key)
  RETURNING id INTO v_channel;

  INSERT INTO chat_participants (channel_id, user_type, user_id, sub_user_id) VALUES
    (v_channel, o.left_type,  CASE WHEN o.left_type  = 'admin'    THEN o.left_id  END, CASE WHEN o.left_type  = 'sub_user' THEN o.left_id  END),
    (v_channel, o.right_type, CASE WHEN o.right_type = 'admin'    THEN o.right_id END, CASE WHEN o.right_type = 'sub_user' THEN o.right_id END)
  ON CONFLICT ON CONSTRAINT chat_participants_unique_4col DO NOTHING;

  RETURN v_channel;
END;
$$;

-- 4) Make sure anon/authenticated can execute
GRANT EXECUTE ON FUNCTION public.find_or_create_dm(uuid, text, uuid, text, uuid) TO anon, authenticated;

COMMIT;