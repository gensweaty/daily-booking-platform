-- Fix missing start_public_board_dm function and ensure proper constraints
CREATE OR REPLACE FUNCTION public.start_public_board_dm(
  p_board_owner_id uuid,
  p_sender_email text,
  p_target_type text,
  p_target_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sender_sub_user_id uuid;
  v_channel_id uuid;
  v_target_user_id uuid;
  v_target_sub_user_id uuid;
BEGIN
  -- Validate sender is a sub-user for this board
  SELECT id INTO v_sender_sub_user_id
  FROM sub_users
  WHERE board_owner_id = p_board_owner_id
    AND lower(email) = lower(p_sender_email)
  LIMIT 1;

  IF v_sender_sub_user_id IS NULL THEN
    RAISE EXCEPTION 'Sender email % not found as sub-user for board %', p_sender_email, p_board_owner_id;
  END IF;

  -- Resolve target based on type
  IF p_target_type = 'admin' THEN
    v_target_user_id := p_target_id;
    v_target_sub_user_id := NULL;
  ELSIF p_target_type = 'sub_user' THEN
    v_target_user_id := NULL;
    v_target_sub_user_id := p_target_id;
    
    -- Validate target sub-user exists for this board
    IF NOT EXISTS (
      SELECT 1 FROM sub_users 
      WHERE id = p_target_id AND board_owner_id = p_board_owner_id
    ) THEN
      RAISE EXCEPTION 'Target sub-user % not found for board %', p_target_id, p_board_owner_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid target type %. Must be admin or sub_user', p_target_type;
  END IF;

  -- Get or create DM channel using existing function
  SELECT public.get_or_create_canonical_dm(
    p_board_owner_id,
    'sub_user',
    v_sender_sub_user_id,
    p_target_type,
    p_target_id
  ) INTO v_channel_id;

  RETURN v_channel_id;
END;
$function$;

-- Fix chat_participants constraint issue by ensuring proper ON CONFLICT handling
CREATE OR REPLACE FUNCTION public.ensure_dm_channel(p_board_owner_id uuid, p_a_type text, p_a_id uuid, p_b_type text, p_b_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_key text; v_channel_id uuid;
BEGIN
  v_key := make_dm_pair_key(p_a_type, p_a_id, p_b_type, p_b_id);

  INSERT INTO chat_channels (owner_id, is_dm, is_private, name, dm_pair_key, participants, updated_at)
  VALUES (p_board_owner_id, TRUE, TRUE, 'Direct Message', v_key, jsonb_build_array(p_a_id, p_b_id), now())
  ON CONFLICT (owner_id, dm_pair_key)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_channel_id;

  -- Use proper constraint name for participants
  INSERT INTO chat_participants (channel_id, user_id, sub_user_id, user_type)
  VALUES 
    (v_channel_id, CASE WHEN p_a_type='admin' THEN p_a_id ELSE NULL END,
                     CASE WHEN p_a_type='sub_user' THEN p_a_id ELSE NULL END, p_a_type),
    (v_channel_id, CASE WHEN p_b_type='admin' THEN p_b_id ELSE NULL END,
                     CASE WHEN p_b_type='sub_user' THEN p_b_id ELSE NULL END, p_b_type)
  ON CONFLICT (channel_id, user_id, sub_user_id) DO NOTHING;

  RETURN v_channel_id;
END $function$;