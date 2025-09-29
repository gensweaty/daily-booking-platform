-- Fix chat function conflicts by dropping and recreating
BEGIN;

-- Drop existing functions that conflict
DROP FUNCTION IF EXISTS public.get_channel_header_public(uuid, uuid, text);

-- 1) Fix the ambiguous column reference in list_channel_messages_public_v2
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
BEGIN
  -- First check if channel exists and get its type (fix ambiguous reference)
  SELECT cc.is_dm INTO v_is_dm
  FROM chat_channels cc
  WHERE cc.id = p_channel_id AND cc.owner_id = p_owner_id;

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
    IF v_su_id IS NULL AND p_owner_id != (SELECT auth.uid()) THEN
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

-- 2) Create the helper function for public header resolution  
CREATE FUNCTION public.get_channel_header_public(
  p_channel_id uuid,
  p_owner_id uuid, 
  p_requester_email text
)
RETURNS TABLE(partner_name text, partner_avatar_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id uuid;
BEGIN
  -- Get requester sub_user ID
  SELECT su.id INTO v_requester_id
  FROM sub_users su
  WHERE su.board_owner_id = p_owner_id
    AND lower(su.email) = lower(p_requester_email);

  -- Find the other participant in this DM
  RETURN QUERY
  SELECT 
    CASE 
      WHEN cp.user_type = 'admin' THEN 
        COALESCE(
          (SELECT CASE WHEN p.username LIKE 'user_%' THEN 'Admin' ELSE p.username END FROM profiles p WHERE p.id = cp.user_id),
          'Admin'
        )
      ELSE 
        COALESCE(
          (SELECT su.fullname FROM sub_users su WHERE su.id = cp.sub_user_id),
          'Member'
        )
    END as partner_name,
    CASE 
      WHEN cp.user_type = 'admin' THEN 
        (SELECT p.avatar_url FROM profiles p WHERE p.id = cp.user_id)
      ELSE 
        (SELECT su.avatar_url FROM sub_users su WHERE su.id = cp.sub_user_id)
    END as partner_avatar_url
  FROM chat_participants cp
  WHERE cp.channel_id = p_channel_id
    AND NOT (cp.user_type = 'sub_user' AND cp.sub_user_id = v_requester_id)
    AND NOT (cp.user_type = 'admin' AND cp.user_id = p_owner_id)
  LIMIT 1;
END;
$$;

-- 3) Create missing default channels and ensure all board owners have a General channel
INSERT INTO public.chat_channels (owner_id, name, emoji, is_default, is_dm, is_private)
SELECT DISTINCT 
  p.id as owner_id,
  'General' as name,
  '💬' as emoji,
  true as is_default,
  false as is_dm,
  false as is_private
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM chat_channels cc 
  WHERE cc.owner_id = p.id AND cc.is_default = true
)
ON CONFLICT DO NOTHING;

-- 4) Ensure all board owners are participants in their own General channels
INSERT INTO public.chat_participants (channel_id, user_type, user_id, sub_user_id)
SELECT 
  cc.id as channel_id,
  'admin' as user_type,
  cc.owner_id as user_id,
  NULL as sub_user_id
FROM chat_channels cc
WHERE cc.is_default = true 
  AND NOT EXISTS (
    SELECT 1 FROM chat_participants cp 
    WHERE cp.channel_id = cc.id 
      AND cp.user_type = 'admin' 
      AND cp.user_id = cc.owner_id
  )
ON CONFLICT ON CONSTRAINT chat_participants_unique_identity DO NOTHING;

-- 5) Add missing sub_users to their board owner's default channels
INSERT INTO public.chat_participants (channel_id, user_type, user_id, sub_user_id)
SELECT 
  cc.id as channel_id,
  'sub_user' as user_type,
  NULL as user_id,
  su.id as sub_user_id
FROM sub_users su
JOIN chat_channels cc ON cc.owner_id = su.board_owner_id AND cc.is_default = true
WHERE NOT EXISTS (
  SELECT 1 FROM chat_participants cp 
  WHERE cp.channel_id = cc.id 
    AND cp.user_type = 'sub_user' 
    AND cp.sub_user_id = su.id
)
ON CONFLICT ON CONSTRAINT chat_participants_unique_identity DO NOTHING;

-- Grant permissions on the function
GRANT EXECUTE ON FUNCTION public.get_channel_header_public(uuid, uuid, text) TO anon, authenticated;

COMMIT;