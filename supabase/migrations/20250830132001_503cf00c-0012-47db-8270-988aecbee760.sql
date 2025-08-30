-- Create RPC to get all channels a user participates in
CREATE OR REPLACE FUNCTION public.get_user_participating_channels(
  p_owner_id uuid,
  p_user_type text,
  p_user_email text
) RETURNS TABLE (
  channel_id uuid,
  channel_name text,
  is_dm boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_sub_user_id uuid;
BEGIN
  -- Resolve user IDs based on type
  IF p_user_type = 'admin' THEN
    v_user_id := p_owner_id;
  ELSE
    -- Find sub-user by email
    SELECT su.id INTO v_sub_user_id
    FROM sub_users su
    WHERE su.board_owner_id = p_owner_id
      AND lower(su.email) = lower(p_user_email)
    LIMIT 1;
  END IF;

  -- Return channels the user participates in
  RETURN QUERY
  SELECT DISTINCT
    cc.id as channel_id,
    cc.name as channel_name,
    cc.is_dm
  FROM chat_channels cc
  JOIN chat_participants cp ON cc.id = cp.channel_id
  WHERE cc.owner_id = p_owner_id
    AND (
      (p_user_type = 'admin' AND cp.user_id = v_user_id) OR
      (p_user_type = 'sub_user' AND cp.sub_user_id = v_sub_user_id)
    )
  ORDER BY cc.is_dm ASC, cc.name ASC;
END;
$$;

-- Create RPC to get new messages from multiple channels efficiently
CREATE OR REPLACE FUNCTION public.get_new_messages_multi_channel(
  p_owner_id uuid,
  p_user_email text,
  p_since_timestamp timestamp with time zone DEFAULT NULL
) RETURNS TABLE (
  channel_id uuid,
  message_id uuid,
  content text,
  created_at timestamp with time zone,
  sender_type text,
  sender_name text,
  sender_avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_sub_user_id uuid;
  v_cutoff_time timestamp with time zone;
BEGIN
  -- Find sub-user by email
  SELECT su.id INTO v_sub_user_id
  FROM sub_users su
  WHERE su.board_owner_id = p_owner_id
    AND lower(su.email) = lower(p_user_email)
  LIMIT 1;

  -- Default cutoff time to 1 hour ago if not provided
  v_cutoff_time := COALESCE(p_since_timestamp, NOW() - INTERVAL '1 hour');

  -- Return new messages from channels the user participates in
  RETURN QUERY
  SELECT 
    cm.channel_id,
    cm.id as message_id,
    cm.content,
    cm.created_at,
    cm.sender_type,
    cm.sender_name,
    cm.sender_avatar_url
  FROM chat_messages cm
  JOIN chat_channels cc ON cm.channel_id = cc.id
  JOIN chat_participants cp ON cc.id = cp.channel_id
  WHERE cc.owner_id = p_owner_id
    AND cm.created_at > v_cutoff_time
    AND cp.sub_user_id = v_sub_user_id
    AND cp.user_type = 'sub_user'
  ORDER BY cm.created_at ASC;
END;
$$;