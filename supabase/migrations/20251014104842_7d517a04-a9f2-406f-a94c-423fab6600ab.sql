-- Create a function to ensure each user/sub-user has their own personal AI channel
CREATE OR REPLACE FUNCTION public.ensure_personal_ai_channel(
  p_owner_id uuid,
  p_user_type text,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_channel_id uuid;
  v_participant_key text;
BEGIN
  -- Generate unique participant key for this user
  v_participant_key := CASE 
    WHEN p_user_type = 'admin' THEN 'A:' || p_user_id::text
    ELSE 'S:' || p_user_id::text
  END;

  -- Check if personal AI channel already exists for this specific user
  SELECT cc.id INTO v_channel_id
  FROM chat_channels cc
  JOIN chat_participants cp ON cp.channel_id = cc.id
  WHERE cc.owner_id = p_owner_id 
    AND cc.is_ai = true 
    AND cc.is_deleted = false
    AND cp.participant_key = v_participant_key
  LIMIT 1;

  -- Create if doesn't exist
  IF v_channel_id IS NULL THEN
    INSERT INTO chat_channels (
      owner_id, 
      name, 
      emoji,
      is_ai, 
      is_custom, 
      is_private,
      is_default
    ) VALUES (
      p_owner_id,
      'Smartbookly AI',
      '🤖',
      true,
      false,
      true,  -- Private to individual user
      false
    )
    RETURNING id INTO v_channel_id;

    -- Add ONLY this specific user as participant
    INSERT INTO chat_participants (
      channel_id, 
      user_id,
      sub_user_id,
      user_type,
      participant_key
    ) VALUES (
      v_channel_id, 
      CASE WHEN p_user_type = 'admin' THEN p_user_id ELSE NULL END,
      CASE WHEN p_user_type = 'sub_user' THEN p_user_id ELSE NULL END,
      p_user_type,
      v_participant_key
    )
    ON CONFLICT ON CONSTRAINT chat_participants_unique_identity DO NOTHING;
  END IF;

  RETURN v_channel_id;
END;
$$;