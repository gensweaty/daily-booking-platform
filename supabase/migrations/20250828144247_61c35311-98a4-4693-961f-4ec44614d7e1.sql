DROP FUNCTION IF EXISTS public.get_chat_messages_for_channel(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_chat_messages_for_channel(
  p_channel_id uuid,
  p_board_owner_id uuid
)
RETURNS TABLE (
  id uuid,
  channel_id uuid,
  owner_id uuid,
  sender_type text,
  sender_user_id uuid,
  sender_sub_user_id uuid,
  sender_name text,
  sender_avatar_url text,
  content text,
  reply_to_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  /* Validate the channel belongs to this owner via chat_channels, not chat_messages.owner_id */
  SELECT
    m.id, m.channel_id, m.owner_id, m.sender_type, m.sender_user_id, m.sender_sub_user_id,
    m.sender_name, m.sender_avatar_url, m.content, m.reply_to_id, m.created_at, m.updated_at
  FROM chat_messages m
  JOIN chat_channels ch
    ON ch.id = m.channel_id
  WHERE m.channel_id = p_channel_id
    AND ch.owner_id = p_board_owner_id   -- ownership check here
  ORDER BY m.created_at ASC, m.id ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_messages_for_channel(uuid, uuid) TO anon, authenticated;