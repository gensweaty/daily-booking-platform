-- Create helper function to elevate role to service_role
CREATE OR REPLACE FUNCTION public._as_service_role()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT set_config(
    'request.jwt.claims',
    json_build_object('role','service_role')::text,
    true
  );
$$;

-- Update send_public_board_message to use service role elevation
CREATE OR REPLACE FUNCTION public.send_public_board_message(
  p_board_owner_id uuid,
  p_channel_id uuid,
  p_sender_email text,
  p_content text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_user record;
  v_channel record;
  v_msg record;
BEGIN
  -- Elevate to service role to bypass RLS
  PERFORM public._as_service_role();
  
  IF COALESCE(trim(p_content), '') = '' THEN
    RAISE EXCEPTION 'Empty content';
  END IF;

  -- Find sub_user by email within this owner
  SELECT id, fullname
  INTO v_sub_user
  FROM sub_users
  WHERE board_owner_id = p_board_owner_id
    AND lower(email) = lower(p_sender_email)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sub-user not found for this board';
  END IF;

  -- Validate channel belongs to owner
  SELECT id, owner_id, is_default, is_dm, name
  INTO v_channel
  FROM chat_channels
  WHERE id = p_channel_id
    AND owner_id = p_board_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Channel not found for this board';
  END IF;

  -- Basic participant link (optional; keeps participant rows consistent)
  INSERT INTO chat_participants (channel_id, sub_user_id, user_type)
  VALUES (p_channel_id, v_sub_user.id, 'sub_user')
  ON CONFLICT DO NOTHING;

  INSERT INTO chat_messages (
    channel_id,
    owner_id,
    sender_type,
    sender_sub_user_id,
    sender_name,
    content
  )
  VALUES (
    p_channel_id,
    p_board_owner_id,
    'sub_user',
    v_sub_user.id,
    COALESCE(v_sub_user.fullname, p_sender_email),
    p_content
  )
  RETURNING to_jsonb(chat_messages.*) INTO v_msg;

  -- Update channel last message timestamp
  UPDATE chat_channels
  SET updated_at = NOW()
  WHERE id = p_channel_id;

  RETURN v_msg;
END;
$$;

-- Update start_public_board_dm to use service role elevation
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
  -- Elevate to service role to bypass RLS
  PERFORM public._as_service_role();
  
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

-- Add service role policies for chat operations
DROP POLICY IF EXISTS chat_messages_service_ins ON public.chat_messages;
CREATE POLICY chat_messages_service_ins
ON public.chat_messages
FOR INSERT
TO public
USING ((auth.jwt()->>'role') = 'service_role')
WITH CHECK ((auth.jwt()->>'role') = 'service_role');

DROP POLICY IF EXISTS chat_participants_service_ins ON public.chat_participants;
CREATE POLICY chat_participants_service_ins
ON public.chat_participants
FOR INSERT
TO public
USING ((auth.jwt()->>'role') = 'service_role')
WITH CHECK ((auth.jwt()->>'role') = 'service_role');

DROP POLICY IF EXISTS chat_channels_service_all ON public.chat_channels;
CREATE POLICY chat_channels_service_all
ON public.chat_channels
FOR ALL
TO public
USING ((auth.jwt()->>'role') = 'service_role')
WITH CHECK ((auth.jwt()->>'role') = 'service_role');

-- Ensure proper ownership and permissions
ALTER FUNCTION public.send_public_board_message(uuid, uuid, text, text) OWNER TO postgres;
ALTER FUNCTION public.start_public_board_dm(uuid, text, uuid, text) OWNER TO postgres;
ALTER FUNCTION public._as_service_role() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.send_public_board_message(uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_public_board_dm(uuid, text, uuid, text) TO anon, authenticated;