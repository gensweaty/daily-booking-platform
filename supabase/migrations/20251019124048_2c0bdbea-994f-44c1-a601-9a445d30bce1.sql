-- Fix: Include attachments in list_channel_messages_public_v2 for public board sub-users
-- Voice messages and other attachments were disappearing because they weren't being fetched

-- Drop existing function first
DROP FUNCTION IF EXISTS public.list_channel_messages_public_v2(uuid, uuid, text, uuid);

-- Recreate with attachments column
CREATE OR REPLACE FUNCTION public.list_channel_messages_public_v2(
  p_owner_id uuid,
  p_channel_id uuid,
  p_requester_email text DEFAULT NULL,
  p_requester_sub_user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  content text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  edited_at timestamp with time zone,
  original_content text,
  channel_id uuid,
  sender_type text,
  sender_user_id uuid,
  sender_sub_user_id uuid,
  sender_name text,
  sender_avatar_url text,
  has_attachments boolean,
  message_type text,
  is_deleted boolean,
  attachments jsonb  -- NEW: Include attachments as JSON array
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_dm boolean;
  v_is_ai boolean;
  v_su_id uuid;
BEGIN
  -- Get channel type
  SELECT cc.is_dm, cc.is_ai INTO v_is_dm, v_is_ai
  FROM chat_channels cc
  WHERE cc.id = p_channel_id AND cc.owner_id = p_owner_id;

  -- If channel doesn't exist, return empty
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Resolve requester identity
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

  -- CRITICAL: For AI channels, enforce strict participant checking
  IF COALESCE(v_is_ai, false) = true THEN
    -- AI channel: ONLY return messages if requester is a direct participant
    IF NOT EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.channel_id = p_channel_id
        AND (
          -- Admin participant
          (cp.user_type = 'admin' AND cp.user_id = p_owner_id)
          OR
          -- Sub-user participant - must match exactly
          (cp.user_type = 'sub_user' AND cp.sub_user_id = v_su_id)
        )
    ) THEN
      RETURN; -- Not a participant of this AI channel
    END IF;
  ELSE
    -- Non-AI channel logic
    IF COALESCE(v_is_dm, false) = true THEN
      -- DM: check membership
      IF NOT EXISTS (
        SELECT 1 FROM chat_participants cp
        WHERE cp.channel_id = p_channel_id
          AND (
            cp.participant_key IN ('S:'||v_su_id::text, 'A:'||p_owner_id::text)
            OR (cp.user_id = p_owner_id)
            OR (cp.sub_user_id = v_su_id)
          )
      ) AND NOT EXISTS (
        SELECT 1 FROM chat_messages cm
        WHERE cm.channel_id = p_channel_id
          AND cm.owner_id = p_owner_id
          AND (
            (cm.sender_type = 'sub_user' AND cm.sender_sub_user_id = v_su_id)
            OR (cm.sender_type = 'admin' AND cm.sender_user_id = p_owner_id)
          )
      ) THEN
        RETURN;
      END IF;
    ELSE
      -- Regular channel: any valid sub_user can read
      IF v_su_id IS NULL AND p_owner_id != (SELECT auth.uid()) THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  -- Return messages WITH attachments
  RETURN QUERY
  SELECT
    cm.id, cm.content, cm.created_at, cm.updated_at, cm.edited_at,
    cm.original_content, cm.channel_id, cm.sender_type,
    cm.sender_user_id, cm.sender_sub_user_id,
    COALESCE(
      cm.sender_name,
      CASE WHEN cm.sender_type='admin' THEN 'Admin'
           ELSE COALESCE((SELECT su.fullname FROM sub_users su WHERE su.id=cm.sender_sub_user_id), 'Member')
      END
    ) as sender_name,
    cm.sender_avatar_url,
    cm.has_attachments,
    cm.message_type,
    cm.is_deleted,
    -- Aggregate attachments as JSON array
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', cmf.id,
            'filename', cmf.filename,
            'file_path', cmf.file_path,
            'content_type', cmf.content_type,
            'size', cmf.size,
            'created_at', cmf.created_at
          )
          ORDER BY cmf.created_at
        )
        FROM chat_message_files cmf
        WHERE cmf.message_id = cm.id
      ),
      '[]'::jsonb
    ) as attachments
  FROM chat_messages cm
  WHERE cm.channel_id = p_channel_id
    AND cm.owner_id = p_owner_id
    AND (cm.is_deleted IS NULL OR cm.is_deleted = false)
  ORDER BY cm.created_at ASC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.list_channel_messages_public_v2(uuid, uuid, text, uuid) TO anon, authenticated;