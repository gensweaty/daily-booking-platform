-- Drop and recreate functions to fix return type issues
DROP FUNCTION IF EXISTS public.get_team_members_for_board(uuid);

-- Safer public send that does NOT require an existing sub_user row
CREATE OR REPLACE FUNCTION public.send_public_board_message(
  p_board_owner_id uuid,
  p_channel_id     uuid,
  p_sender_email   text,
  p_content        text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg            jsonb;
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
  )
  RETURNING to_jsonb(chat_messages.*) INTO v_msg;

  UPDATE chat_channels SET updated_at = now() WHERE id = p_channel_id;

  RETURN v_msg;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_team_members_for_board(
  p_board_owner_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  type text,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Always include the owner
  SELECT p.id,
         COALESCE(p.username, 'Admin') AS name,
         'admin'::text AS type,
         p.avatar_url
  FROM profiles p
  WHERE p.id = p_board_owner_id

  UNION ALL

  -- And all sub-users of this board
  SELECT su.id,
         COALESCE(su.fullname, su.email) AS name,
         'sub_user'::text AS type,
         su.avatar_url
  FROM sub_users su
  WHERE su.board_owner_id = p_board_owner_id
  ORDER BY type DESC, name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.send_public_board_message(uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_members_for_board(uuid) TO anon, authenticated;