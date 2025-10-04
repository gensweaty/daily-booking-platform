-- A) Database invariants (one DM per pair)

-- 1. Canonical "pair" ordering helper (stable ordering of two participants)
CREATE OR REPLACE FUNCTION dm_sort_key(p_type text, p_id uuid)
RETURNS text 
LANGUAGE sql 
IMMUTABLE AS $$
  SELECT p_type || ':' || p_id::text
$$;

-- Fixed dm_order_pair function
CREATE OR REPLACE FUNCTION dm_order_pair(a_type text, a_id uuid, b_type text, b_id uuid)
RETURNS table(left_type text, left_id uuid, right_type text, right_id uuid)
LANGUAGE plpgsql 
IMMUTABLE AS $$
DECLARE
  a_key text := dm_sort_key(a_type, a_id);
  b_key text := dm_sort_key(b_type, b_id);
BEGIN
  IF a_key <= b_key THEN
    RETURN QUERY SELECT a_type, a_id, b_type, b_id;
  ELSE
    RETURN QUERY SELECT b_type, b_id, a_type, a_id;
  END IF;
END;
$$;

-- 2. Canonical DM upsert RPC (the only way DMs should be created anywhere)
CREATE OR REPLACE FUNCTION find_or_create_dm(
  p_owner_id uuid,
  p_a_type text, p_a_id uuid,
  p_b_type text, p_b_id uuid
)
RETURNS uuid
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  L record;
  v_channel uuid;
BEGIN
  -- Canonicalize the pair
  SELECT * INTO L FROM dm_order_pair(p_a_type, p_a_id, p_b_type, p_b_id);

  -- Try to find an existing DM that has exactly these two participants
  SELECT ch.id INTO v_channel
  FROM chat_channels ch
  JOIN chat_participants cp1 ON cp1.channel_id = ch.id
  JOIN chat_participants cp2 ON cp2.channel_id = ch.id
  WHERE ch.owner_id = p_owner_id
    AND ch.is_dm = true
    AND (SELECT count(*) FROM chat_participants WHERE channel_id = ch.id) = 2
    AND ((cp1.user_type, COALESCE(cp1.user_id, cp1.sub_user_id)) = (L.left_type, L.left_id))
    AND ((cp2.user_type, COALESCE(cp2.user_id, cp2.sub_user_id)) = (L.right_type, L.right_id))
  LIMIT 1;

  IF v_channel IS NOT NULL THEN
    RETURN v_channel;
  END IF;

  -- Create channel
  INSERT INTO chat_channels (owner_id, name, is_dm, is_private)
  VALUES (p_owner_id, 'Direct Message', true, true)
  RETURNING id INTO v_channel;

  -- Insert exactly two participants (no implicit owner)
  INSERT INTO chat_participants (channel_id, user_type, user_id, sub_user_id)
  VALUES 
    (v_channel, L.left_type,  CASE WHEN L.left_type  = 'admin' THEN L.left_id  END, CASE WHEN L.left_type  = 'sub_user' THEN L.left_id  END),
    (v_channel, L.right_type, CASE WHEN L.right_type = 'admin' THEN L.right_id END, CASE WHEN L.right_type = 'sub_user' THEN L.right_id END);

  RETURN v_channel;
END;
$$;

-- B) Public-link safe message reads

-- 3. Public read RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION list_channel_messages_public(
  p_owner_id uuid,
  p_channel_id uuid,
  p_requester_type text,       -- 'admin' | 'sub_user'
  p_requester_email text       -- for sub_user
)
RETURNS TABLE(
  id uuid, content text, created_at timestamptz,
  sender_user_id uuid, sender_sub_user_id uuid,
  sender_type text, sender_name text, sender_avatar_url text,
  channel_id uuid
)
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_req_id uuid;
  v_is_participant boolean;
BEGIN
  IF p_requester_type = 'admin' THEN
    v_req_id := p_owner_id;
  ELSE
    SELECT id INTO v_req_id
    FROM sub_users
    WHERE board_owner_id = p_owner_id
      AND lower(email) = lower(p_requester_email)
    LIMIT 1;
  END IF;

  IF v_req_id IS NULL THEN
    RAISE EXCEPTION 'Requester not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM chat_participants
    WHERE channel_id = p_channel_id
      AND (
        (p_requester_type='admin'    AND user_type='admin'    AND user_id = v_req_id) OR
        (p_requester_type='sub_user' AND user_type='sub_user' AND sub_user_id = v_req_id)
      )
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  RETURN QUERY
    SELECT m.id, m.content, m.created_at, m.sender_user_id, m.sender_sub_user_id,
           m.sender_type, m.sender_name, m.sender_avatar_url, m.channel_id
    FROM chat_messages m
    WHERE m.channel_id = p_channel_id
    ORDER BY m.created_at ASC;
END;
$$;

-- D) Sub-user registration "ON CONFLICT" error fix

-- Enforce uniqueness of a sub-user email within a board
CREATE UNIQUE INDEX IF NOT EXISTS sub_users_owner_email_uk
  ON sub_users(board_owner_id, lower(email));