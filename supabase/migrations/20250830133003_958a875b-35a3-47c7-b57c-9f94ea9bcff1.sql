-- Create RPC function to list all channels for a sub-user (public safe)
CREATE OR REPLACE FUNCTION list_channels_for_sub_user_public(
  p_owner_id uuid,
  p_email text
) RETURNS TABLE(channel_id uuid) 
LANGUAGE sql 
SECURITY DEFINER 
AS $$
  SELECT cp.channel_id
  FROM chat_participants cp
  JOIN sub_users su ON su.id = cp.sub_user_id
  WHERE su.board_owner_id = p_owner_id
    AND lower(su.email) = lower(p_email)
    AND cp.user_type = 'sub_user';
$$;