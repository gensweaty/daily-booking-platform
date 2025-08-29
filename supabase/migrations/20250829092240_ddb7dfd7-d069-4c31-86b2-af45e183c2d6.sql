-- 1) Add missing unique constraint for participants (fixes ON CONFLICT error)
ALTER TABLE public.chat_participants
  ADD CONSTRAINT chat_participants_unique
  UNIQUE (channel_id, user_id, sub_user_id);

-- 2) Add canonical DM pair key + unique index (prevents duplicate DM channels)
ALTER TABLE public.chat_channels
  ADD COLUMN IF NOT EXISTS dm_pair_key text;

-- Only enforce uniqueness for DMs
CREATE UNIQUE INDEX IF NOT EXISTS chat_channels_owner_pair_key_uidx
  ON public.chat_channels(owner_id, dm_pair_key)
  WHERE is_dm = true;

-- 3) Helpers to build the canonical pair key (order-independent, type-aware)
CREATE OR REPLACE FUNCTION public.canonical_participant_key(p_type text, p_id uuid)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT (CASE WHEN p_type='admin' THEN 'A:' ELSE 'S:' END) || p_id::text
$$;

CREATE OR REPLACE FUNCTION public.make_dm_pair_key(p_a_type text, p_a_id uuid, p_b_type text, p_b_id uuid)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE k1 text; k2 text;
BEGIN
  k1 := canonical_participant_key(p_a_type, p_a_id);
  k2 := canonical_participant_key(p_b_type, p_b_id);
  IF k1 <= k2 THEN
    RETURN k1||'|'||k2;
  ELSE
    RETURN k2||'|'||k1;
  END IF;
END $$;

-- 4) One RPC to create/ensure a DM channel (always 2 participants, never auto-add owner unless they're one side)
CREATE OR REPLACE FUNCTION public.ensure_dm_channel(
  p_board_owner_id uuid,
  p_a_type text, p_a_id uuid,
  p_b_type text, p_b_id uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE v_key text; v_channel_id uuid;
BEGIN
  v_key := make_dm_pair_key(p_a_type, p_a_id, p_b_type, p_b_id);

  INSERT INTO chat_channels (owner_id, is_dm, is_private, name, dm_pair_key, participants, updated_at)
  VALUES (p_board_owner_id, TRUE, TRUE, 'Direct Message', v_key, jsonb_build_array(p_a_id, p_b_id), now())
  ON CONFLICT (owner_id, dm_pair_key)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_channel_id;

  INSERT INTO chat_participants (channel_id, user_id, sub_user_id, user_type)
  VALUES 
    (v_channel_id, CASE WHEN p_a_type='admin' THEN p_a_id ELSE NULL END,
                     CASE WHEN p_a_type='sub_user' THEN p_a_id ELSE NULL END, p_a_type),
    (v_channel_id, CASE WHEN p_b_type='admin' THEN p_b_id ELSE NULL END,
                     CASE WHEN p_b_type='sub_user' THEN p_b_id ELSE NULL END, p_b_type)
  ON CONFLICT (channel_id, user_id, sub_user_id) DO NOTHING;

  RETURN v_channel_id;
END $$;

-- 5) One unified "send message" RPC (used by both internal and public boards)
CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_owner_id uuid,
  p_channel_id uuid,
  p_sender_type text,   -- 'admin' | 'sub_user'
  p_sender_id uuid,
  p_content text
)
RETURNS chat_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE v_msg chat_messages;
BEGIN
  -- Channel must belong to this board
  IF NOT EXISTS (
    SELECT 1 FROM chat_channels ch
    WHERE ch.id = p_channel_id AND ch.owner_id = p_owner_id
  ) THEN
    RAISE EXCEPTION 'Invalid channel';
  END IF;

  -- Sender must be a participant in the channel
  IF NOT EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.channel_id = p_channel_id
      AND ((p_sender_type='admin'    AND cp.user_id     = p_sender_id) OR
           (p_sender_type='sub_user' AND cp.sub_user_id = p_sender_id))
  ) THEN
    RAISE EXCEPTION 'Sender is not a participant';
  END IF;

  INSERT INTO chat_messages (
    owner_id, channel_id, content, sender_type, sender_user_id, sender_sub_user_id
  ) VALUES (
    p_owner_id, p_channel_id, p_content, p_sender_type,
    CASE WHEN p_sender_type='admin' THEN p_sender_id ELSE NULL END,
    CASE WHEN p_sender_type='sub_user' THEN p_sender_id ELSE NULL END
  )
  RETURNING * INTO v_msg;

  RETURN v_msg;
END $$;