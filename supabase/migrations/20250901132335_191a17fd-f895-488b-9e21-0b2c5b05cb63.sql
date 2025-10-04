-- Add last_read_at column to chat_participants if it doesn't exist
ALTER TABLE chat_participants
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ DEFAULT '1970-01-01'::TIMESTAMPTZ NOT NULL;

-- RPC: mark a channel as read
CREATE OR REPLACE FUNCTION mark_channel_read(
  p_owner_id uuid,
  p_viewer_type text,   -- 'admin' | 'sub_user'
  p_viewer_id uuid,
  p_channel_id uuid
) RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE chat_participants cp
     SET last_read_at = now()
   WHERE cp.channel_id = p_channel_id
     AND EXISTS (
       SELECT 1 FROM chat_channels cc 
       WHERE cc.id = p_channel_id AND cc.owner_id = p_owner_id
     )
     AND ((p_viewer_type = 'admin' AND cp.user_type = 'admin' AND cp.user_id = p_viewer_id)
       OR (p_viewer_type = 'sub_user' AND cp.user_type = 'sub_user' AND cp.sub_user_id = p_viewer_id));
END $$;

-- RPC: unread counters for this viewer (per-channel + per-peer)
CREATE OR REPLACE FUNCTION unread_counters(
  p_owner_id uuid,
  p_viewer_type text,   -- 'admin' | 'sub_user'
  p_viewer_id uuid
) RETURNS TABLE(
  channel_id uuid,
  channel_unread int,
  peer_id uuid,
  peer_type text,
  peer_unread int
) 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
  WITH my_rows AS (
    SELECT cp.channel_id, cp.last_read_at
      FROM chat_participants cp
      JOIN chat_channels cc ON cc.id = cp.channel_id
     WHERE cc.owner_id = p_owner_id
       AND ((p_viewer_type = 'admin' AND cp.user_type = 'admin' AND cp.user_id = p_viewer_id)
         OR (p_viewer_type = 'sub_user' AND cp.user_type = 'sub_user' AND cp.sub_user_id = p_viewer_id))
  ),
  msgs AS (
    SELECT m.channel_id, m.created_at,
           COALESCE(m.sender_user_id, m.sender_sub_user_id) AS sender_any_id,
           CASE WHEN m.sender_user_id IS NOT NULL THEN 'admin' ELSE 'sub_user' END AS sender_type
      FROM chat_messages m
     WHERE m.owner_id = p_owner_id
       -- Don't count my own messages
       AND NOT ((p_viewer_type = 'admin' AND m.sender_user_id = p_viewer_id)
             OR (p_viewer_type = 'sub_user' AND m.sender_sub_user_id = p_viewer_id))
  ),
  channel_cte AS (
    SELECT r.channel_id,
           COUNT(*)::int AS channel_unread
      FROM msgs m
      JOIN my_rows r ON r.channel_id = m.channel_id AND m.created_at > r.last_read_at
     GROUP BY r.channel_id
  ),
  peer_cte AS (
    -- only for DMs (2 participants)
    SELECT r.channel_id,
           m.sender_any_id AS peer_id,
           m.sender_type AS peer_type,
           COUNT(*)::int AS peer_unread
      FROM msgs m
      JOIN my_rows r ON r.channel_id = m.channel_id AND m.created_at > r.last_read_at
      JOIN chat_channels c ON c.id = m.channel_id AND c.is_dm = true
     GROUP BY r.channel_id, m.sender_any_id, m.sender_type
  )
  SELECT
    COALESCE(c.channel_id, p.channel_id) AS channel_id,
    COALESCE(c.channel_unread, 0) AS channel_unread,
    p.peer_id,
    p.peer_type,
    COALESCE(p.peer_unread, 0) AS peer_unread
  FROM channel_cte c
  FULL OUTER JOIN peer_cte p ON p.channel_id = c.channel_id;
$$;