-- Create service functions for public board chat access that bypass RLS

-- Function to get chat messages for a channel (bypasses RLS for public boards)
CREATE OR REPLACE FUNCTION public.get_chat_messages_for_channel(p_channel_id UUID, p_board_owner_id UUID DEFAULT NULL)
RETURNS TABLE(
  id UUID,
  content TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  sender_user_id UUID,
  sender_sub_user_id UUID,
  sender_type TEXT,
  sender_name TEXT,
  sender_avatar_url TEXT,
  channel_id UUID,
  owner_id UUID,
  reply_to_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return messages for the channel
  -- If board_owner_id is provided, verify the channel belongs to that board
  RETURN QUERY
  SELECT 
    cm.id,
    cm.content,
    cm.created_at,
    cm.updated_at,
    cm.sender_user_id,
    cm.sender_sub_user_id,
    cm.sender_type,
    cm.sender_name,
    cm.sender_avatar_url,
    cm.channel_id,
    cm.owner_id,
    cm.reply_to_id
  FROM chat_messages cm
  WHERE cm.channel_id = p_channel_id
  AND (p_board_owner_id IS NULL OR cm.owner_id = p_board_owner_id)
  ORDER BY cm.created_at ASC;
END;
$$;

-- Function to get team members for a board (bypasses RLS for public boards)
CREATE OR REPLACE FUNCTION public.get_team_members_for_board(p_board_owner_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  type TEXT,
  avatar_url TEXT,
  email TEXT
)
LANGUAGE plpgsql  
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return admin first
  RETURN QUERY
  SELECT 
    p.id,
    COALESCE(p.username, 'Admin') as name,
    'admin'::TEXT as type,
    p.avatar_url,
    NULL::TEXT as email
  FROM profiles p
  WHERE p.id = p_board_owner_id;
  
  -- Then return sub-users
  RETURN QUERY
  SELECT 
    su.id,
    COALESCE(su.fullname, su.email, 'Member') as name,
    'sub_user'::TEXT as type,
    su.avatar_url,
    su.email
  FROM sub_users su
  WHERE su.board_owner_id = p_board_owner_id;
END;
$$;

-- Function to get default channel for a board (bypasses RLS for public boards)
CREATE OR REPLACE FUNCTION public.get_default_channel_for_board(p_board_owner_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  participant_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.id,
    cc.name,
    COUNT(cp.id) as participant_count
  FROM chat_channels cc
  LEFT JOIN chat_participants cp ON cc.id = cp.channel_id
  WHERE cc.owner_id = p_board_owner_id 
  AND cc.is_default = true
  AND cc.name = 'General'
  GROUP BY cc.id, cc.name, cc.created_at
  ORDER BY COUNT(cp.id) DESC, cc.created_at ASC
  LIMIT 1;
END;
$$;