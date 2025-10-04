-- Fix the send_authenticated_message RPC to use email fallback when username is auto-generated
CREATE OR REPLACE FUNCTION public.send_authenticated_message(p_channel_id uuid, p_owner_id uuid, p_content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid;
  v_sender_name text;
  v_sender_avatar text;
  v_user_email text;
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

  -- Get user email from auth.users for fallback
  SELECT email INTO v_user_email 
  FROM auth.users 
  WHERE id = v_me;

  -- Get sender name and avatar from profiles table with improved fallback logic
  SELECT 
    CASE 
      -- If username starts with "user_" it's auto-generated, use email local part
      WHEN p.username LIKE 'user_%' THEN 
        COALESCE(
          NULLIF(split_part(v_user_email, '@', 1), ''),
          'Admin'
        )
      ELSE 
        COALESCE(p.username, 'Admin')
    END as display_name,
    p.avatar_url
  INTO v_sender_name, v_sender_avatar
  FROM profiles p
  WHERE p.id = v_me;

  -- If no profile found, use email fallback
  IF v_sender_name IS NULL THEN
    v_sender_name := COALESCE(
      NULLIF(split_part(v_user_email, '@', 1), ''),
      'Admin'
    );
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
    v_sender_name,
    v_sender_avatar,
    p_content
  );

  UPDATE chat_channels SET updated_at = NOW() WHERE id = p_channel_id;

  -- Return NULL to avoid immediate echo (let real-time handle it)
  RETURN NULL;
END;
$function$;