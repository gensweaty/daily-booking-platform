-- Fix list_channel_messages_public function - resolve ambiguous column references
CREATE OR REPLACE FUNCTION public.list_channel_messages_public(p_owner_id uuid, p_channel_id uuid, p_requester_type text, p_requester_email text)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, sender_user_id uuid, sender_sub_user_id uuid, sender_type text, sender_name text, sender_avatar_url text, channel_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_req_id uuid;
  v_is_participant boolean;
BEGIN
  IF p_requester_type = 'admin' THEN
    v_req_id := p_owner_id;
  ELSE
    SELECT su.id INTO v_req_id
    FROM sub_users su
    WHERE su.board_owner_id = p_owner_id
      AND lower(su.email) = lower(p_requester_email)
    LIMIT 1;
  END IF;

  IF v_req_id IS NULL THEN
    RAISE EXCEPTION 'Requester not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM chat_participants cp
    WHERE cp.channel_id = p_channel_id
      AND (
        (p_requester_type='admin'    AND cp.user_type='admin'    AND cp.user_id = v_req_id) OR
        (p_requester_type='sub_user' AND cp.user_type='sub_user' AND cp.sub_user_id = v_req_id)
      )
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  RETURN QUERY
    SELECT m.id, m.content, m.created_at, m.sender_user_id, m.sender_sub_user_id,
           m.sender_type, m.sender_name, m.sender_avatar_url, m.channel_id
    FROM chat_messages m
    WHERE m.channel_id = p_channel_id
    ORDER BY m.created_at ASC;
END;
$function$;

-- Create a helper function to get admin display names (with enhanced logic)
CREATE OR REPLACE FUNCTION public.get_admin_display_name(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_username text;
  v_email text;
  v_display_name text;
BEGIN
  -- Get profile data
  SELECT p.username INTO v_username
  FROM profiles p
  WHERE p.id = p_user_id;
  
  -- Get email from auth.users
  SELECT au.email INTO v_email
  FROM auth.users au
  WHERE au.id = p_user_id;
  
  -- Enhanced name resolution logic
  IF v_username IS NULL THEN
    v_display_name := 'Admin';
  ELSIF v_username LIKE 'user_%' THEN
    -- Auto-generated username, use email local part or fallback
    v_display_name := COALESCE(
      NULLIF(split_part(v_email, '@', 1), ''),
      'Admin'
    );
  ELSE
    v_display_name := v_username;
  END IF;
  
  RETURN v_display_name;
END;
$function$;

-- Clean up duplicate DM channels and ensure data consistency
SELECT public.consolidate_duplicate_dm_channels();