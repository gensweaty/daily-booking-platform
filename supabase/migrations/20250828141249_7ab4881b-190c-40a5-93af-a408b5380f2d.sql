-- Create RPC for authenticated dashboard message sending
CREATE OR REPLACE FUNCTION public.send_authenticated_message(
  p_channel_id uuid,
  p_owner_id   uuid,
  p_content    text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg jsonb;
  v_me uuid;
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
    content
  )
  SELECT
    p_channel_id,
    p_owner_id,
    'admin',
    v_me,
    COALESCE(p.username, 'Admin'),
    p_content
  FROM profiles p
  WHERE p.id = v_me
  RETURNING to_jsonb(chat_messages.*) INTO v_msg;

  UPDATE chat_channels SET updated_at = NOW() WHERE id = p_channel_id;

  RETURN v_msg;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_authenticated_message(uuid, uuid, text) TO authenticated;