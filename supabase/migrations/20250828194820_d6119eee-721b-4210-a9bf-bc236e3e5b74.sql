-- Create the start_public_board_dm function
CREATE OR REPLACE FUNCTION public.start_public_board_dm(p_board_owner_id uuid, p_sender_email text, p_other_id uuid, p_other_type text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Look for an existing DM via participants JSON (simpler approach for dashboard compatibility)
  SELECT ch.id
  INTO v_existing
  FROM chat_channels ch
  WHERE ch.owner_id = p_board_owner_id
    AND ch.is_dm = TRUE
    AND ch.participants @> jsonb_build_array(v_me_sub.id)
    AND ch.participants @> jsonb_build_array(p_other_id)
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Create a new DM channel using JSON participants for consistency
  INSERT INTO chat_channels (owner_id, is_dm, name, participants, updated_at)
  VALUES (
    p_board_owner_id,
    TRUE,
    'Direct Message',
    jsonb_build_array(v_me_sub.id, p_other_id),
    NOW()
  )
  RETURNING id INTO v_new;

  RETURN v_new;
END;
$$;