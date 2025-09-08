-- Create paged RPC functions for chat messages

-- Internal boards paged function
CREATE OR REPLACE FUNCTION get_chat_messages_for_channel_paged(
  p_board_owner_id uuid,
  p_channel_id uuid,
  p_limit int DEFAULT 40,
  p_before timestamptz DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  content text,
  sender_name text,
  sender_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  has_attachments boolean,
  has_more boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count int;
  returned_count int;
BEGIN
  -- Get total count of messages in channel
  SELECT COUNT(*) INTO total_count
  FROM chat_messages cm
  WHERE cm.channel_id = p_channel_id
    AND cm.board_owner_id = p_board_owner_id;

  -- Return messages based on cursor
  IF p_before IS NULL THEN
    -- Initial load - get last p_limit messages
    RETURN QUERY
    WITH message_data AS (
      SELECT 
        cm.id,
        cm.content,
        COALESCE(p.display_name, au.email, cm.sender_id::text) as sender_name,
        cm.sender_id,
        cm.created_at,
        cm.updated_at,
        EXISTS(SELECT 1 FROM chat_message_files cmf WHERE cmf.message_id = cm.id) as has_attachments
      FROM chat_messages cm
      LEFT JOIN profiles p ON p.user_id = cm.sender_id
      LEFT JOIN auth.users au ON au.id = cm.sender_id
      WHERE cm.channel_id = p_channel_id
        AND cm.board_owner_id = p_board_owner_id
      ORDER BY cm.created_at DESC
      LIMIT p_limit
    )
    SELECT 
      md.*,
      (total_count > p_limit) as has_more
    FROM message_data md
    ORDER BY md.created_at ASC;
  ELSE
    -- Paging - get messages older than p_before
    RETURN QUERY
    WITH message_data AS (
      SELECT 
        cm.id,
        cm.content,
        COALESCE(p.display_name, au.email, cm.sender_id::text) as sender_name,
        cm.sender_id,
        cm.created_at,
        cm.updated_at,
        EXISTS(SELECT 1 FROM chat_message_files cmf WHERE cmf.message_id = cm.id) as has_attachments
      FROM chat_messages cm
      LEFT JOIN profiles p ON p.user_id = cm.sender_id
      LEFT JOIN auth.users au ON au.id = cm.sender_id
      WHERE cm.channel_id = p_channel_id
        AND cm.board_owner_id = p_board_owner_id
        AND cm.created_at < p_before
      ORDER BY cm.created_at DESC
      LIMIT p_limit
    )
    SELECT 
      md.*,
      EXISTS(
        SELECT 1 FROM chat_messages cm2 
        WHERE cm2.channel_id = p_channel_id 
          AND cm2.board_owner_id = p_board_owner_id
          AND cm2.created_at < (SELECT MIN(created_at) FROM message_data)
      ) as has_more
    FROM message_data md
    ORDER BY md.created_at ASC;
  END IF;
END;
$$;

-- Public boards paged function
CREATE OR REPLACE FUNCTION list_channel_messages_public_paged(
  p_owner_id uuid,
  p_channel_id uuid,
  p_requester_type text,
  p_requester_email text,
  p_limit int DEFAULT 40,
  p_before timestamptz DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  content text,
  sender_name text,
  sender_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  has_attachments boolean,
  has_more boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count int;
  returned_count int;
BEGIN
  -- Get total count of messages in channel
  SELECT COUNT(*) INTO total_count
  FROM chat_messages cm
  WHERE cm.channel_id = p_channel_id
    AND cm.board_owner_id = p_owner_id;

  -- Return messages based on cursor
  IF p_before IS NULL THEN
    -- Initial load - get last p_limit messages
    RETURN QUERY
    WITH message_data AS (
      SELECT 
        cm.id,
        cm.content,
        CASE 
          WHEN cm.sender_id = p_owner_id THEN COALESCE(p.display_name, au.email, 'Owner')
          WHEN p_requester_type = 'user' AND EXISTS(
            SELECT 1 FROM sub_users su 
            WHERE su.user_id = cm.sender_id 
              AND su.board_owner_id = p_owner_id
          ) THEN COALESCE(p.display_name, au.email, 'Sub User')
          WHEN p_requester_type = 'public' AND cm.sender_id::text = p_requester_email THEN p_requester_email
          ELSE 'Anonymous'
        END as sender_name,
        cm.sender_id,
        cm.created_at,
        cm.updated_at,
        EXISTS(SELECT 1 FROM chat_message_files cmf WHERE cmf.message_id = cm.id) as has_attachments
      FROM chat_messages cm
      LEFT JOIN profiles p ON p.user_id = cm.sender_id
      LEFT JOIN auth.users au ON au.id = cm.sender_id
      WHERE cm.channel_id = p_channel_id
        AND cm.board_owner_id = p_owner_id
      ORDER BY cm.created_at DESC
      LIMIT p_limit
    )
    SELECT 
      md.*,
      (total_count > p_limit) as has_more
    FROM message_data md
    ORDER BY md.created_at ASC;
  ELSE
    -- Paging - get messages older than p_before
    RETURN QUERY
    WITH message_data AS (
      SELECT 
        cm.id,
        cm.content,
        CASE 
          WHEN cm.sender_id = p_owner_id THEN COALESCE(p.display_name, au.email, 'Owner')
          WHEN p_requester_type = 'user' AND EXISTS(
            SELECT 1 FROM sub_users su 
            WHERE su.user_id = cm.sender_id 
              AND su.board_owner_id = p_owner_id
          ) THEN COALESCE(p.display_name, au.email, 'Sub User')
          WHEN p_requester_type = 'public' AND cm.sender_id::text = p_requester_email THEN p_requester_email
          ELSE 'Anonymous'
        END as sender_name,
        cm.sender_id,
        cm.created_at,
        cm.updated_at,
        EXISTS(SELECT 1 FROM chat_message_files cmf WHERE cmf.message_id = cm.id) as has_attachments
      FROM chat_messages cm
      LEFT JOIN profiles p ON p.user_id = cm.sender_id
      LEFT JOIN auth.users au ON au.id = cm.sender_id
      WHERE cm.channel_id = p_channel_id
        AND cm.board_owner_id = p_owner_id
        AND cm.created_at < p_before
      ORDER BY cm.created_at DESC
      LIMIT p_limit
    )
    SELECT 
      md.*,
      EXISTS(
        SELECT 1 FROM chat_messages cm2 
        WHERE cm2.channel_id = p_channel_id 
          AND cm2.board_owner_id = p_owner_id
          AND cm2.created_at < (SELECT MIN(created_at) FROM message_data)
      ) as has_more
    FROM message_data md
    ORDER BY md.created_at ASC;
  END IF;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created_at 
ON chat_messages(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_message_files_message_id 
ON chat_message_files(message_id);