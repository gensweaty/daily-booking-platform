-- Fix the send_authenticated_message function to properly get sender name and avoid duplicates
CREATE OR REPLACE FUNCTION public.send_authenticated_message(p_channel_id uuid, p_owner_id uuid, p_content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_msg jsonb;
  v_me uuid;
  v_sender_name text;
  v_sender_avatar text;
BEGIN
  IF COALESCE(trim(p_content), '') = '' THEN
    RAISE EXCEPTION 'Empty content';
  END IF;

  -- current signed-in admin
  v_me := auth.uid();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- must be the board owner
  IF v_me <> p_owner_id THEN
    RAISE EXCEPTION 'Only board owner can send via dashboard';
  END IF;

  -- ensure channel belongs to this owner
  PERFORM 1 FROM chat_channels WHERE id = p_channel_id AND owner_id = p_owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Channel not found for this board';
  END IF;

  -- Get sender name and avatar from profiles table
  SELECT COALESCE(p.username, 'Admin'), p.avatar_url
  INTO v_sender_name, v_sender_avatar
  FROM profiles p
  WHERE p.id = v_me;

  -- If no profile found, fallback
  IF v_sender_name IS NULL THEN
    v_sender_name := 'Admin';
  END IF;

  -- ensure membership row (optional)
  INSERT INTO chat_participants (channel_id, user_id, user_type)
  VALUES (p_channel_id, v_me, 'admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO chat_messages (
    channel_id,
    owner_id,
    sender_type,
    sender_user_id,
    sender_name,
    sender_avatar_url,
    content
  )
  VALUES (
    p_channel_id,
    p_owner_id,
    'admin',
    v_me,
    v_sender_name,  -- Use the name from profiles
    v_sender_avatar,
    p_content
  );

  UPDATE chat_channels SET updated_at = NOW() WHERE id = p_channel_id;

  -- Return NULL to avoid immediate echo (let real-time handle it)
  RETURN NULL;
END;
$$;

-- Fix the send_public_board_message function to avoid duplicates  
CREATE OR REPLACE FUNCTION public.send_public_board_message(p_board_owner_id uuid, p_channel_id uuid, p_sender_email text, p_content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub_user_id    uuid;
  v_sender_name    text;
  v_sender_avatar  text;
BEGIN
  IF COALESCE(trim(p_content), '') = '' THEN
    RAISE EXCEPTION 'Empty content';
  END IF;

  -- Ensure channel belongs to this owner
  PERFORM 1
  FROM chat_channels ch
  WHERE ch.id = p_channel_id AND ch.owner_id = p_board_owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Channel not found for this board';
  END IF;

  -- Try to resolve to an existing sub_user (preferred)
  SELECT su.id, su.fullname, su.avatar_url
    INTO v_sub_user_id, v_sender_name, v_sender_avatar
  FROM sub_users su
  WHERE su.board_owner_id = p_board_owner_id
    AND lower(su.email) = lower(p_sender_email)
  LIMIT 1;

  -- If no sub_user, try to get a display name from public_board_access (guest)
  IF v_sub_user_id IS NULL THEN
    SELECT pba.external_user_name
      INTO v_sender_name
    FROM public_board_access pba
    JOIN public_boards pb ON pb.id = pba.board_id
    WHERE pb.user_id = p_board_owner_id
      AND (pba.external_user_email IS NULL OR lower(pba.external_user_email) = lower(p_sender_email))
    ORDER BY pba.created_at DESC
    LIMIT 1;

    IF v_sender_name IS NULL THEN
      -- final fallback: local part of the email
      v_sender_name := NULLIF(split_part(p_sender_email, '@', 1), '')::text;
      IF v_sender_name IS NULL THEN
        v_sender_name := 'Guest';
      END IF;
    END IF;
  END IF;

  -- Ensure participant row when we have a real sub_user
  IF v_sub_user_id IS NOT NULL THEN
    INSERT INTO chat_participants (channel_id, sub_user_id, user_type)
    VALUES (p_channel_id, v_sub_user_id, 'sub_user')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Insert message (owner is the board owner; sender is either sub_user or guest)
  INSERT INTO chat_messages (
    channel_id,
    owner_id,
    sender_type,
    sender_user_id,
    sender_sub_user_id,
    sender_name,
    sender_avatar_url,
    content
  ) VALUES (
    p_channel_id,
    p_board_owner_id,
    'sub_user',              -- keep UI logic simple
    NULL,                    -- no dashboard user here
    v_sub_user_id,           -- may be NULL for guests
    v_sender_name,
    v_sender_avatar,
    p_content
  );

  UPDATE chat_channels SET updated_at = now() WHERE id = p_channel_id;

  -- Return NULL to avoid immediate echo (let real-time handle it)
  RETURN NULL;
END;
$$;