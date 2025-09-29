-- Emergency fix for chat functionality broken by Sept 29 schema changes
BEGIN;

-- 1) First, let's fix any invalid participant_key entries by regenerating them properly
UPDATE public.chat_participants 
SET user_type = CASE 
  WHEN user_id IS NOT NULL AND sub_user_id IS NULL THEN 'admin'
  WHEN sub_user_id IS NOT NULL AND user_id IS NULL THEN 'sub_user'
  ELSE user_type
END
WHERE participant_key = 'X:invalid' OR participant_key IS NULL;

-- 2) For any remaining invalid entries, try to infer the correct type from the data
UPDATE public.chat_participants 
SET 
  user_type = 'admin',
  user_id = COALESCE(user_id, sub_user_id),
  sub_user_id = NULL
WHERE participant_key = 'X:invalid' 
  AND user_id IS NULL 
  AND sub_user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = sub_user_id);

-- 3) Fix ensure_dm_channel to be more robust and always ensure participants exist
CREATE OR REPLACE FUNCTION public.ensure_dm_channel(
  p_owner_id uuid,
  p_a_type text, p_a_id uuid,
  p_b_type text, p_b_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o record;
  v_key text;
  v_channel uuid;
BEGIN
  -- Ensure DM helper functions exist
  SELECT * INTO o FROM dm_order_pair(p_a_type, p_a_id, p_b_type, p_b_id);
  v_key := make_dm_pair_key(p_a_type, p_a_id, p_b_type, p_b_id);

  -- Find existing channel
  SELECT id INTO v_channel
  FROM public.chat_channels
  WHERE owner_id = p_owner_id AND is_dm = true AND dm_pair_key = v_key
  LIMIT 1;

  -- Create channel if it doesn't exist
  IF v_channel IS NULL THEN
    INSERT INTO public.chat_channels (owner_id, name, is_dm, is_private, dm_pair_key)
    VALUES (p_owner_id, 'Direct Message', true, true, v_key)
    ON CONFLICT ON CONSTRAINT chat_channels_owner_isdm_dmkey_uniq DO NOTHING
    RETURNING id INTO v_channel;

    -- Handle race condition
    IF v_channel IS NULL THEN
      SELECT id INTO v_channel
      FROM public.chat_channels
      WHERE owner_id = p_owner_id AND is_dm = true AND dm_pair_key = v_key
      LIMIT 1;
    END IF;
  END IF;

  -- ALWAYS ensure both participants exist (moved outside the IF block)
  -- This fixes the critical bug where existing DM channels had no participants
  INSERT INTO public.chat_participants (channel_id, user_type, user_id, sub_user_id)
  VALUES (
    v_channel,
    o.left_type,
    CASE WHEN o.left_type='admin' THEN o.left_id END,
    CASE WHEN o.left_type='sub_user' THEN o.left_id END
  )
  ON CONFLICT ON CONSTRAINT chat_participants_unique_identity DO NOTHING;

  INSERT INTO public.chat_participants (channel_id, user_type, user_id, sub_user_id)
  VALUES (
    v_channel,
    o.right_type,
    CASE WHEN o.right_type='admin' THEN o.right_id END,
    CASE WHEN o.right_type='sub_user' THEN o.right_id END
  )
  ON CONFLICT ON CONSTRAINT chat_participants_unique_identity DO NOTHING;

  RETURN v_channel;
END;
$$;

-- 4) Make list_channel_messages_public_v2 more forgiving
CREATE OR REPLACE FUNCTION public.list_channel_messages_public_v2(
  p_owner_id uuid,
  p_channel_id uuid,
  p_requester_email text DEFAULT NULL,
  p_requester_sub_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, content text, created_at timestamptz, updated_at timestamptz,
  edited_at timestamptz, original_content text, channel_id uuid,
  sender_type text, sender_user_id uuid, sender_sub_user_id uuid,
  sender_name text, sender_avatar_url text, has_attachments boolean,
  message_type text, is_deleted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_dm boolean;
  v_su_id uuid;
  v_channel_exists boolean;
BEGIN
  -- First check if channel exists and get its type
  SELECT is_dm INTO v_is_dm
  FROM chat_channels
  WHERE id = p_channel_id AND owner_id = p_owner_id;

  -- If channel doesn't exist, return empty
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Resolve requester identity more robustly
  IF p_requester_sub_user_id IS NOT NULL THEN
    SELECT su.id INTO v_su_id
    FROM sub_users su
    WHERE su.id = p_requester_sub_user_id
      AND su.board_owner_id = p_owner_id;
  ELSIF p_requester_email IS NOT NULL THEN
    SELECT su.id INTO v_su_id
    FROM sub_users su
    WHERE su.board_owner_id = p_owner_id
      AND lower(su.email) = lower(p_requester_email);
  END IF;

  -- For DMs, check membership more leniently
  IF COALESCE(v_is_dm, false) = true THEN
    -- DM: check if requester is a participant OR if there are any messages from them
    IF NOT EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.channel_id = p_channel_id
        AND (
          cp.participant_key IN ('S:'||v_su_id::text, 'A:'||p_owner_id::text)
          OR (cp.user_id = p_owner_id)
          OR (cp.sub_user_id = v_su_id)
        )
    ) AND NOT EXISTS (
      -- Also allow if there are messages from this user (legacy data)
      SELECT 1 FROM chat_messages cm
      WHERE cm.channel_id = p_channel_id
        AND cm.owner_id = p_owner_id
        AND (
          (cm.sender_type = 'sub_user' AND cm.sender_sub_user_id = v_su_id)
          OR (cm.sender_type = 'admin' AND cm.sender_user_id = p_owner_id)
        )
    ) THEN
      RETURN; -- No access
    END IF;
  ELSE
    -- Non-DM: any valid sub_user under this owner can read
    IF v_su_id IS NULL AND p_owner_id != auth.uid() THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    cm.id, cm.content, cm.created_at, cm.updated_at, cm.edited_at,
    cm.original_content, cm.channel_id, cm.sender_type,
    cm.sender_user_id, cm.sender_sub_user_id,
    COALESCE(
      cm.sender_name,
      CASE WHEN cm.sender_type='admin' THEN 'Admin'
           ELSE COALESCE((SELECT su.fullname FROM sub_users su WHERE su.id=cm.sender_sub_user_id),'Member')
      END
    ) AS sender_name,
    cm.sender_avatar_url, cm.has_attachments, cm.message_type, cm.is_deleted
  FROM chat_messages cm
  WHERE cm.channel_id = p_channel_id
    AND cm.owner_id = p_owner_id
    AND (cm.is_deleted IS NULL OR cm.is_deleted = false)
  ORDER BY cm.created_at ASC;
END;
$$;

-- 5) Comprehensive backfill to fix all existing DM channels
-- This ensures ALL DM channels have proper participants based on message history
WITH dm_channels AS (
  SELECT id, owner_id FROM chat_channels WHERE is_dm = true
),
message_senders AS (
  SELECT DISTINCT
    cm.channel_id,
    cm.sender_type,
    cm.sender_user_id,
    cm.sender_sub_user_id,
    dc.owner_id as channel_owner_id
  FROM chat_messages cm
  JOIN dm_channels dc ON dc.id = cm.channel_id
  WHERE (cm.sender_type = 'admin' AND cm.sender_user_id IS NOT NULL)
     OR (cm.sender_type = 'sub_user' AND cm.sender_sub_user_id IS NOT NULL)
),
participants_to_add AS (
  SELECT 
    ms.channel_id,
    ms.sender_type as user_type,
    CASE WHEN ms.sender_type = 'admin' THEN ms.sender_user_id END as user_id,
    CASE WHEN ms.sender_type = 'sub_user' THEN ms.sender_sub_user_id END as sub_user_id
  FROM message_senders ms
  WHERE NOT EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.channel_id = ms.channel_id
      AND cp.user_type = ms.sender_type
      AND (
        (ms.sender_type = 'admin' AND cp.user_id = ms.sender_user_id)
        OR (ms.sender_type = 'sub_user' AND cp.sub_user_id = ms.sender_sub_user_id)
      )
  )
)
INSERT INTO chat_participants (channel_id, user_type, user_id, sub_user_id)
SELECT channel_id, user_type, user_id, sub_user_id
FROM participants_to_add
ON CONFLICT ON CONSTRAINT chat_participants_unique_identity DO NOTHING;

COMMIT;