-- Fix start_public_board_dm function to use chat_participants joins and grant execute permissions
CREATE OR REPLACE FUNCTION public.start_public_board_dm(
  p_board_owner_id uuid,
  p_sender_email   text,   -- current sub-user email
  p_other_id       uuid,   -- target participant id
  p_other_type     text    -- 'admin' | 'sub_user'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me_sub record;
  v_existing uuid;
  v_new uuid;
BEGIN
  -- Resolve current sub-user by email
  SELECT id INTO v_me_sub
  FROM sub_users
  WHERE board_owner_id = p_board_owner_id
    AND lower(email) = lower(p_sender_email)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sub-user not found';
  END IF;

  -- Look for an existing DM via chat_participants
  SELECT ch.id
  INTO v_existing
  FROM chat_channels ch
  JOIN chat_participants cp_me
    ON cp_me.channel_id = ch.id
   AND cp_me.sub_user_id = v_me_sub.id
  JOIN chat_participants cp_other
    ON cp_other.channel_id = ch.id
   AND (
        (p_other_type = 'admin'    AND cp_other.user_id    = p_other_id) OR
        (p_other_type = 'sub_user' AND cp_other.sub_user_id = p_other_id)
       )
  WHERE ch.owner_id = p_board_owner_id
    AND ch.is_dm = TRUE
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Create a new DM channel
  INSERT INTO chat_channels (owner_id, is_dm, name, participants, updated_at)
  VALUES (
    p_board_owner_id,
    TRUE,
    'Direct Message',
    NULL,                -- avoid stale JSON; we trust chat_participants instead
    NOW()
  )
  RETURNING id INTO v_new;

  -- Ensure participants exist
  INSERT INTO chat_participants (channel_id, sub_user_id, user_type)
  VALUES (v_new, v_me_sub.id, 'sub_user')
  ON CONFLICT DO NOTHING;

  IF p_other_type = 'admin' THEN
    INSERT INTO chat_participants (channel_id, user_id, user_type)
    VALUES (v_new, p_other_id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO chat_participants (channel_id, sub_user_id, user_type)
    VALUES (v_new, p_other_id, 'sub_user')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_new;
END;
$$;

-- Grant execute permissions on the RPC functions
GRANT EXECUTE ON FUNCTION public.send_public_board_message(uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_public_board_dm(uuid, text, uuid, text) TO anon, authenticated;