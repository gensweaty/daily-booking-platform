-- Fix the start_public_board_dm function to create proper peer-to-peer DMs
CREATE OR REPLACE FUNCTION public.start_public_board_dm(
  p_board_owner_id uuid, 
  p_sender_email text, 
  p_other_id uuid, 
  p_other_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me_sub record;
  v_existing uuid;
  v_new uuid;
BEGIN
  -- Resolve current sub-user by email
  SELECT id, fullname INTO v_me_sub
  FROM sub_users
  WHERE board_owner_id = p_board_owner_id
    AND lower(email) = lower(p_sender_email)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sub-user not found';
  END IF;

  -- Look for existing PEER-TO-PEER DM (exactly 2 participants)
  SELECT ch.id INTO v_existing
  FROM chat_channels ch
  WHERE ch.owner_id = p_board_owner_id
    AND ch.is_dm = TRUE
    AND (
      -- Check via participants JSON field for exact match
      (ch.participants @> jsonb_build_array(v_me_sub.id) AND 
       ch.participants @> jsonb_build_array(p_other_id) AND
       jsonb_array_length(ch.participants) = 2)
    )
  LIMIT 1;

  -- If no exact match via JSON, check via chat_participants table
  IF v_existing IS NULL THEN
    SELECT ch.id INTO v_existing
    FROM chat_channels ch
    JOIN chat_participants cp1 ON ch.id = cp1.channel_id
    JOIN chat_participants cp2 ON ch.id = cp2.channel_id
    WHERE ch.owner_id = p_board_owner_id
      AND ch.is_dm = TRUE
      -- First participant is me (sub-user)
      AND cp1.sub_user_id = v_me_sub.id
      AND cp1.user_type = 'sub_user'
      -- Second participant is the other person
      AND (
        (p_other_type = 'admin' AND cp2.user_id = p_other_id AND cp2.user_type = 'admin') OR
        (p_other_type = 'sub_user' AND cp2.sub_user_id = p_other_id AND cp2.user_type = 'sub_user')
      )
      -- Ensure exactly 2 participants total
      AND (SELECT COUNT(*) FROM chat_participants WHERE channel_id = ch.id) = 2
    LIMIT 1;
  END IF;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Create a new PEER-TO-PEER DM channel
  INSERT INTO chat_channels (owner_id, is_dm, name, participants, updated_at)
  VALUES (
    p_board_owner_id,
    TRUE,
    'Direct Message',
    jsonb_build_array(v_me_sub.id, p_other_id),
    NOW()
  )
  RETURNING id INTO v_new;

  -- Add ONLY the two participants (no board owner unless they're one of the participants)
  INSERT INTO chat_participants (channel_id, sub_user_id, user_type)
  VALUES (v_new, v_me_sub.id, 'sub_user')
  ON CONFLICT DO NOTHING;

  -- Add the other participant
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
$function$;