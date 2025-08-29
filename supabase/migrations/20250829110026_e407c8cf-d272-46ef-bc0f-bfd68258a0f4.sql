-- 1) Stable ordering and pair-key function
CREATE OR REPLACE FUNCTION make_dm_pair_key(
  p_a_type text, p_a_id uuid,
  p_b_type text, p_b_id uuid
) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT (o.left_type || ':' || o.left_id::text || '|' || o.right_type || ':' || o.right_id::text)
  FROM dm_order_pair(p_a_type, p_a_id, p_b_type, p_b_id) o
$$;

-- 2) Canonical upsert function - use this everywhere
CREATE OR REPLACE FUNCTION public.find_or_create_dm(
  p_owner_id uuid,
  p_a_type text, p_a_id uuid,
  p_b_type text, p_b_id uuid
)
RETURNS uuid
SECURITY DEFINER
LANGUAGE plpgsql AS $$
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
    (v_channel, o.right_type, CASE WHEN o.right_type = 'admin'    THEN o.right_id END, CASE WHEN o.right_type = 'sub_user' THEN o.right_id END);

  RETURN v_channel;
END;
$$;

-- 3) DB invariant: only one DM per owner+pair
CREATE UNIQUE INDEX IF NOT EXISTS chat_channels_dm_uniq
ON chat_channels(owner_id, dm_pair_key)
WHERE is_dm = true;

-- 4) Simplified backfill for existing DM channels (only for 2-participant channels)
DO $$
DECLARE
  dm_channel RECORD;
  participant1 RECORD;
  participant2 RECORD;
BEGIN
  -- Loop through all DM channels without dm_pair_key that have exactly 2 participants
  FOR dm_channel IN 
    SELECT ch.id, ch.owner_id
    FROM chat_channels ch
    WHERE ch.is_dm = true 
      AND ch.dm_pair_key IS NULL
      AND (SELECT COUNT(*) FROM chat_participants WHERE channel_id = ch.id) = 2
  LOOP
    -- Get the two participants
    SELECT * INTO participant1
    FROM chat_participants 
    WHERE channel_id = dm_channel.id
    ORDER BY id
    LIMIT 1;
    
    SELECT * INTO participant2
    FROM chat_participants 
    WHERE channel_id = dm_channel.id 
      AND id != participant1.id
    LIMIT 1;
    
    -- Update the channel with the dm_pair_key
    UPDATE chat_channels 
    SET dm_pair_key = make_dm_pair_key(
      participant1.user_type,
      COALESCE(participant1.user_id, participant1.sub_user_id),
      participant2.user_type,
      COALESCE(participant2.user_id, participant2.sub_user_id)
    )
    WHERE id = dm_channel.id;
  END LOOP;
END $$;