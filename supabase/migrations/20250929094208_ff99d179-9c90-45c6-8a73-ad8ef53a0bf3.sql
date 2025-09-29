-- First drop existing functions that need to be recreated
DROP FUNCTION IF EXISTS public.get_chat_messages_for_channel(uuid, uuid);
DROP FUNCTION IF EXISTS public.list_channel_messages_public(uuid, uuid, text, text);

-- Drop duplicate unique constraints that are causing DM creation issues
ALTER TABLE chat_participants DROP CONSTRAINT IF EXISTS chat_participants_unique;
ALTER TABLE chat_participants DROP CONSTRAINT IF EXISTS unique_channel_participant;
ALTER TABLE chat_participants DROP CONSTRAINT IF EXISTS chat_participants_uq_triplet;

-- Create function to get chat messages for channel
CREATE OR REPLACE FUNCTION public.get_chat_messages_for_channel(p_board_owner_id uuid, p_channel_id uuid)
RETURNS TABLE(
  id uuid,
  content text,
  created_at timestamptz,
  updated_at timestamptz,
  edited_at timestamptz,
  original_content text,
  channel_id uuid,
  sender_type text,
  sender_user_id uuid,
  sender_sub_user_id uuid,
  sender_name text,
  sender_avatar_url text,
  has_attachments boolean,
  message_type text,
  is_deleted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.content,
    cm.created_at,
    cm.updated_at,
    cm.edited_at,
    cm.original_content,
    cm.channel_id,
    cm.sender_type,
    cm.sender_user_id,
    cm.sender_sub_user_id,
    COALESCE(
      cm.sender_name,
      CASE 
        WHEN cm.sender_type = 'admin' THEN 
          COALESCE(
            (SELECT CASE WHEN p.username LIKE 'user_%' THEN 'Admin' ELSE p.username END FROM profiles p WHERE p.id = cm.sender_user_id),
            'Admin'
          )
        ELSE
          COALESCE(
            (SELECT su.fullname FROM sub_users su WHERE su.id = cm.sender_sub_user_id),
            'Member'
          )
      END
    ) as sender_name,
    cm.sender_avatar_url,
    cm.has_attachments,
    cm.message_type,
    cm.is_deleted
  FROM chat_messages cm
  WHERE cm.channel_id = p_channel_id
    AND cm.owner_id = p_board_owner_id
    AND (cm.is_deleted IS NULL OR cm.is_deleted = false)
  ORDER BY cm.created_at ASC;
END;
$$;

-- Create function for public board message listing
CREATE OR REPLACE FUNCTION public.list_channel_messages_public(
  p_owner_id uuid,
  p_channel_id uuid,
  p_requester_type text,
  p_requester_email text
)
RETURNS TABLE(
  id uuid,
  content text,
  created_at timestamptz,
  updated_at timestamptz,
  edited_at timestamptz,
  original_content text,
  channel_id uuid,
  sender_type text,
  sender_user_id uuid,
  sender_sub_user_id uuid,
  sender_name text,
  sender_avatar_url text,
  has_attachments boolean,
  message_type text,
  is_deleted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify requester has access to this channel
  IF NOT EXISTS (
    SELECT 1 FROM chat_participants cp
    JOIN sub_users su ON su.id = cp.sub_user_id
    WHERE cp.channel_id = p_channel_id
      AND su.board_owner_id = p_owner_id
      AND lower(su.email) = lower(p_requester_email)
      AND cp.user_type = 'sub_user'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    cm.id,
    cm.content,
    cm.created_at,
    cm.updated_at,
    cm.edited_at,
    cm.original_content,
    cm.channel_id,
    cm.sender_type,
    cm.sender_user_id,
    cm.sender_sub_user_id,
    COALESCE(
      cm.sender_name,
      CASE 
        WHEN cm.sender_type = 'admin' THEN 'Admin'
        ELSE
          COALESCE(
            (SELECT su.fullname FROM sub_users su WHERE su.id = cm.sender_sub_user_id),
            'Member'
          )
      END
    ) as sender_name,
    cm.sender_avatar_url,
    cm.has_attachments,
    cm.message_type,
    cm.is_deleted
  FROM chat_messages cm
  WHERE cm.channel_id = p_channel_id
    AND cm.owner_id = p_owner_id
    AND (cm.is_deleted IS NULL OR cm.is_deleted = false)
  ORDER BY cm.created_at ASC;
END;
$$;

-- Create function to list files for messages (public boards)
CREATE OR REPLACE FUNCTION public.list_files_for_messages_public(p_message_ids uuid[])
RETURNS TABLE(
  id uuid,
  message_id uuid,
  filename text,
  file_path text,
  content_type text,
  size bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cmf.id,
    cmf.message_id,
    cmf.filename,
    cmf.file_path,
    cmf.content_type,
    cmf.size
  FROM chat_message_files cmf
  WHERE cmf.message_id = ANY(p_message_ids);
END;
$$;