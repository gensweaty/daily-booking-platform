-- Update send_public_board_message to return created message info
CREATE OR REPLACE FUNCTION public.send_public_board_message(
  p_board_owner_id uuid,
  p_channel_id uuid,
  p_sender_email text,
  p_content text
)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  sender_name text,
  sender_avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub sub_users%ROWTYPE;
  v_message_id uuid;
  v_created_at timestamptz;
  v_sender_name text;
  v_sender_avatar_url text;
BEGIN
  -- Resolve public sender into sub_users row
  SELECT * INTO v_sub
  FROM sub_users
  WHERE board_owner_id = p_board_owner_id AND email = p_sender_email
  LIMIT 1;

  IF v_sub.id IS NULL THEN
    RAISE EXCEPTION 'Unknown public sub-user % for owner %', p_sender_email, p_board_owner_id;
  END IF;

  INSERT INTO chat_messages (
    id, owner_id, channel_id, content,
    sender_type, sender_sub_user_id,
    sender_name, sender_avatar_url,
    has_attachments, message_type
  )
  VALUES (
    gen_random_uuid(), p_board_owner_id, p_channel_id, p_content,
    'sub_user', v_sub.id,
    v_sub.fullname, v_sub.avatar_url,
    false, 'text'
  )
  RETURNING chat_messages.id, chat_messages.created_at,
            chat_messages.sender_name, chat_messages.sender_avatar_url
  INTO v_message_id, v_created_at, v_sender_name, v_sender_avatar_url;

  RETURN QUERY SELECT v_message_id, v_created_at, v_sender_name, v_sender_avatar_url;
END $$;

-- Create function to attach files by explicit message ID
CREATE OR REPLACE FUNCTION public.attach_files_to_message_public_by_id(
  p_owner_id uuid,
  p_message_id uuid,
  p_files jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f jsonb;
BEGIN
  -- Ensure the message belongs to this owner
  IF NOT EXISTS (SELECT 1 FROM chat_messages WHERE id = p_message_id AND owner_id = p_owner_id) THEN
    RAISE EXCEPTION 'Message not found or owner mismatch';
  END IF;

  FOR f IN SELECT * FROM jsonb_array_elements(p_files)
  LOOP
    INSERT INTO chat_message_files (id, message_id, filename, file_path, content_type, size)
    VALUES (
      gen_random_uuid(),
      p_message_id,
      (f->>'filename'),
      (f->>'file_path'),
      (f->>'content_type'),
      COALESCE((f->>'size')::bigint, NULL)
    );
  END LOOP;

  UPDATE chat_messages
  SET has_attachments = true, message_type = 'file'
  WHERE id = p_message_id;
END $$;

-- Update list_channel_messages_public to be DM-aware
CREATE OR REPLACE FUNCTION public.list_channel_messages_public(
  p_owner_id uuid,
  p_channel_id uuid,
  p_requester_type text,
  p_requester_email text
)
RETURNS TABLE(
  id uuid,
  channel_id uuid,
  created_at timestamptz,
  content text,
  sender_type text,
  sender_user_id uuid,
  sender_sub_user_id uuid,
  sender_name text,
  sender_avatar_url text,
  has_attachments boolean,
  message_type text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH me AS (
  SELECT su.id AS sub_id
  FROM sub_users su
  WHERE su.board_owner_id = p_owner_id AND su.email = p_requester_email
  LIMIT 1
),
ch AS (
  SELECT c.*
  FROM chat_channels c
  WHERE c.id = p_channel_id AND c.owner_id = p_owner_id
),
-- if DM, ensure "me" participates
dm_gate AS (
  SELECT 1
  FROM ch
  LEFT JOIN chat_participants cp ON cp.channel_id = ch.id
  LEFT JOIN me ON TRUE
  WHERE (ch.is_dm IS NOT TRUE) 
     OR (cp.user_type = 'sub_user' AND cp.sub_user_id = me.sub_id)
  LIMIT 1
)
SELECT m.id, m.channel_id, m.created_at, m.content,
       m.sender_type, m.sender_user_id, m.sender_sub_user_id,
       COALESCE(m.sender_name, 'Member') AS sender_name,
       m.sender_avatar_url,
       m.has_attachments,
       m.message_type
FROM dm_gate, chat_messages m
WHERE m.channel_id = p_channel_id AND m.owner_id = p_owner_id
ORDER BY m.created_at ASC;
$$;

-- Create function for proper DM headers on public boards
CREATE OR REPLACE FUNCTION public.get_channel_header_public(
  p_owner_id uuid,
  p_channel_id uuid,
  p_requester_email text
)
RETURNS TABLE(
  name text,
  is_dm boolean,
  partner_name text,
  partner_avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_dm boolean;
  v_me uuid;
  v_partner_name text;
  v_partner_avatar text;
  v_channel_name text;
BEGIN
  SELECT is_dm, name INTO v_is_dm, v_channel_name FROM chat_channels
  WHERE id = p_channel_id AND owner_id = p_owner_id;

  IF NOT v_is_dm THEN
    RETURN QUERY SELECT COALESCE(v_channel_name, 'General')::text, false, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT id INTO v_me
  FROM sub_users
  WHERE board_owner_id = p_owner_id AND email = p_requester_email
  LIMIT 1;

  -- find the other participant visible to a public sub_user
  SELECT su.fullname, su.avatar_url
    INTO v_partner_name, v_partner_avatar
  FROM chat_participants cp
  JOIN sub_users su ON su.id = cp.sub_user_id
  WHERE cp.channel_id = p_channel_id
    AND cp.user_type = 'sub_user'
    AND su.id <> v_me
  LIMIT 1;

  -- Also check for admin participants
  IF v_partner_name IS NULL THEN
    SELECT p.username, p.avatar_url
      INTO v_partner_name, v_partner_avatar
    FROM chat_participants cp
    JOIN profiles p ON p.id = cp.user_id
    WHERE cp.channel_id = p_channel_id
      AND cp.user_type = 'admin'
    LIMIT 1;
  END IF;

  RETURN QUERY SELECT
    ('DM: ' || COALESCE(v_partner_name, 'Member'))::text,
    true,
    COALESCE(v_partner_name, 'Member'),
    v_partner_avatar;
END $$;