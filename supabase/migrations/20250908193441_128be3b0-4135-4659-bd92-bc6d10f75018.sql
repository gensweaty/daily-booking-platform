-- Drop existing functions with full signatures
DROP FUNCTION IF EXISTS get_chat_messages_for_channel_paged(uuid,uuid,integer,timestamp with time zone);
DROP FUNCTION IF EXISTS list_channel_messages_public_paged(uuid,uuid,text,text,integer,timestamp with time zone);

-- Internal boards - paged version  
CREATE FUNCTION get_chat_messages_for_channel_paged(
  p_board_owner_id uuid,
  p_channel_id uuid,
  p_limit int DEFAULT 40,
  p_before timestamptz DEFAULT NULL
)
RETURNS TABLE (
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    m.id, m.content, m.created_at, m.updated_at, m.edited_at, m.original_content,
    m.channel_id, m.sender_type, m.sender_user_id, m.sender_sub_user_id,
    m.sender_name, m.sender_avatar_url, m.has_attachments, m.message_type, m.is_deleted
  FROM public.chat_messages m
  WHERE m.owner_id = p_board_owner_id
    AND m.channel_id = p_channel_id
    AND (p_before IS NULL OR m.created_at < p_before)
  ORDER BY m.created_at DESC
  LIMIT p_limit
$$;

-- Public boards - paged version (RLS-safe)
CREATE FUNCTION list_channel_messages_public_paged(
  p_owner_id uuid,
  p_channel_id uuid,
  p_requester_type text,
  p_requester_email text,
  p_limit int DEFAULT 40,
  p_before timestamptz DEFAULT NULL
)
RETURNS SETOF public.chat_messages
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT m.*
  FROM public.chat_messages m
  WHERE m.owner_id = p_owner_id
    AND m.channel_id = p_channel_id
    AND (p_before IS NULL OR m.created_at < p_before)
  ORDER BY m.created_at DESC
  LIMIT p_limit
$$;

-- Performance indexes for pagination
CREATE INDEX IF NOT EXISTS chat_messages_channel_created_desc
  ON public.chat_messages (channel_id, created_at DESC);
  
CREATE INDEX IF NOT EXISTS chat_message_files_message_id
  ON public.chat_message_files (message_id);