-- Create per-member AI channel function
-- This ensures each user/sub-user gets their own private AI channel
-- No more shared AI history across workspace members

CREATE OR REPLACE FUNCTION public.ensure_unique_ai_channel(
  p_owner_id uuid,
  p_user_identity text   -- formats: 'A:<owner_uuid>' | 'S:<sub_user_uuid>' | email
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_channel_id uuid;
  v_is_admin   boolean;
  v_su_id      uuid;
  v_sub text := substring(p_user_identity from 3); -- after "A:" or "S:"
BEGIN
  -- resolve identity
  IF p_user_identity LIKE 'A:%' THEN
    v_is_admin := true;
  ELSIF p_user_identity LIKE 'S:%' THEN
    v_is_admin := false;
    BEGIN v_su_id := v_sub::uuid; EXCEPTION WHEN OTHERS THEN v_su_id := null; END;
  ELSE
    v_is_admin := false;
    SELECT su.id INTO v_su_id
    FROM sub_users su
    WHERE su.board_owner_id = p_owner_id
      AND lower(su.email) = lower(p_user_identity)
    LIMIT 1;
    IF v_su_id IS NULL THEN
      -- fallback: treat as admin (rare)
      v_is_admin := true;
    END IF;
  END IF;

  -- find existing per-member AI channel
  SELECT cc.id INTO v_channel_id
  FROM chat_channels cc
  WHERE cc.owner_id = p_owner_id
    AND cc.is_ai = true
    AND cc.is_dm = true
    AND cc.is_deleted = false
    AND EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.channel_id = cc.id
        AND (
          (v_is_admin AND cp.user_type='admin' AND cp.user_id = p_owner_id)
          OR
          (NOT v_is_admin AND cp.user_type='sub_user' AND cp.sub_user_id = v_su_id)
        )
    )
  LIMIT 1;

  IF v_channel_id IS NOT NULL THEN
    RETURN v_channel_id;
  END IF;

  -- create new per-member AI channel
  INSERT INTO chat_channels (owner_id, name, is_dm, is_ai, is_custom, is_deleted)
  VALUES (p_owner_id, 'AI Assistant', true, true, false, false)
  RETURNING id INTO v_channel_id;

  IF v_is_admin THEN
    INSERT INTO chat_participants (channel_id, user_type, user_id)
    VALUES (v_channel_id, 'admin', p_owner_id);
  ELSE
    INSERT INTO chat_participants (channel_id, user_type, sub_user_id)
    VALUES (v_channel_id, 'sub_user', v_su_id);
  END IF;

  RETURN v_channel_id;
END;
$$;