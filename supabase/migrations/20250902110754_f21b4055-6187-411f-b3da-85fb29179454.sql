-- Replace start_public_board_dm to use canonical DM creation
DROP FUNCTION IF EXISTS public.start_public_board_dm(uuid, text, uuid, text);

-- Unify DM creation so internal & public return the SAME channel
CREATE OR REPLACE FUNCTION public.start_public_board_dm(
  p_board_owner_id uuid,
  p_other_id uuid,          -- peer to open with
  p_other_type text,        -- 'admin'|'sub_user'
  p_sender_email text       -- public sub-user who clicks
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me sub_users%ROWTYPE;
  v_channel uuid;
BEGIN
  -- resolve the public viewer to a sub_user row
  SELECT * INTO v_me
  FROM sub_users
  WHERE board_owner_id = p_board_owner_id AND email = p_sender_email
  LIMIT 1;

  IF v_me.id IS NULL THEN
    RAISE EXCEPTION 'Unknown public sub-user % for owner %', p_sender_email, p_board_owner_id;
  END IF;

  -- use the SAME canonical creator as the internal path
  v_channel := public.get_or_create_canonical_dm(
    p_board_owner_id,
    'sub_user',    v_me.id,
    p_other_type,  p_other_id
  );

  RETURN v_channel;
END $$;

-- Internal viewer DM header (viewer may be admin or sub_user)
CREATE OR REPLACE FUNCTION public.get_channel_header_internal(
  p_owner_id uuid,
  p_channel_id uuid,
  p_viewer_id uuid,
  p_viewer_type text        -- 'admin'|'sub_user'
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
  v_partner_name text;
  v_partner_avatar text;
  v_channel_name text;
BEGIN
  SELECT is_dm, name
    INTO v_is_dm, v_channel_name
  FROM chat_channels
  WHERE id = p_channel_id AND owner_id = p_owner_id;

  IF NOT v_is_dm THEN
    RETURN QUERY SELECT COALESCE(v_channel_name, 'General')::text, false, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Find "the other" participant
  IF p_viewer_type = 'admin' THEN
    -- viewer is admin -> other should be the sub_user (if any)
    SELECT su.fullname, su.avatar_url
      INTO v_partner_name, v_partner_avatar
    FROM chat_participants cp
    JOIN sub_users su ON su.id = cp.sub_user_id
    WHERE cp.channel_id = p_channel_id
      AND cp.user_type = 'sub_user'
    LIMIT 1;

    IF v_partner_name IS NULL THEN
      -- fallback: show channel name or 'Member'
      v_partner_name := COALESCE(v_channel_name, 'Member');
    END IF;
  ELSE
    -- viewer is sub_user -> other could be an admin or a different sub_user
    SELECT p.username, p.avatar_url
      INTO v_partner_name, v_partner_avatar
    FROM chat_participants cp
    JOIN profiles p ON p.id = cp.user_id
    WHERE cp.channel_id = p_channel_id
      AND cp.user_type = 'admin'
    LIMIT 1;

    IF v_partner_name IS NULL THEN
      -- DM sub_user↔sub_user (rare but allowed)
      SELECT su.fullname, su.avatar_url
        INTO v_partner_name, v_partner_avatar
      FROM chat_participants cp
      JOIN sub_users su ON su.id = cp.sub_user_id
      WHERE cp.channel_id = p_channel_id
        AND cp.user_type = 'sub_user'
        AND su.id <> p_viewer_id
      LIMIT 1;
    END IF;

    IF v_partner_name IS NULL THEN
      v_partner_name := COALESCE(v_channel_name, 'Member');
    END IF;
  END IF;

  RETURN QUERY SELECT
    ('DM: ' || COALESCE(v_partner_name, 'Member'))::text,
    true,
    COALESCE(v_partner_name, 'Member'),
    v_partner_avatar;
END $$;