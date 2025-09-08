-- Update get_chat_messages_for_channel to include edit-related fields
CREATE OR REPLACE FUNCTION public.get_chat_messages_for_channel(p_board_owner_id uuid, p_channel_id uuid)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, updated_at timestamp with time zone, edited_at timestamp with time zone, original_content text, is_deleted boolean, sender_user_id uuid, sender_sub_user_id uuid, sender_type text, sender_name text, sender_avatar_url text, channel_id uuid, has_attachments boolean, message_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  select 
    cm.id,
    cm.content,
    cm.created_at,
    cm.updated_at,
    cm.edited_at,
    cm.original_content,
    cm.is_deleted,
    cm.sender_user_id,
    cm.sender_sub_user_id,
    cm.sender_type,
    cm.sender_name,
    cm.sender_avatar_url,
    cm.channel_id,
    cm.has_attachments,
    cm.message_type
  from chat_messages cm
  join chat_channels cc on cm.channel_id = cc.id
  where cc.owner_id = p_board_owner_id
    and cm.channel_id = p_channel_id
  order by cm.created_at asc;
end
$function$;

-- Update list_channel_messages_public to include edit-related fields
CREATE OR REPLACE FUNCTION public.list_channel_messages_public(p_owner_id uuid, p_channel_id uuid, p_requester_type text, p_requester_email text)
 RETURNS TABLE(id uuid, channel_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, edited_at timestamp with time zone, original_content text, is_deleted boolean, content text, sender_type text, sender_user_id uuid, sender_sub_user_id uuid, sender_name text, sender_avatar_url text, has_attachments boolean, message_type text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH me AS (
  SELECT su.id AS sub_id
  FROM sub_users su
  WHERE su.board_owner_id = p_owner_id AND su.email = p_requester_email
  LIMIT 1
),
ch AS (
  SELECT c.*
  FROM chat_channels c
  WHERE c.id = p_channel_id AND c.owner_id = p_owner_id
),
-- if DM, ensure "me" participates
dm_gate AS (
  SELECT 1
  FROM ch
  LEFT JOIN chat_participants cp ON cp.channel_id = ch.id
  LEFT JOIN me ON TRUE
  WHERE (ch.is_dm IS NOT TRUE) 
     OR (cp.user_type = 'sub_user' AND cp.sub_user_id = me.sub_id)
  LIMIT 1
)
SELECT m.id, m.channel_id, m.created_at, m.updated_at, m.edited_at, m.original_content, m.is_deleted, m.content,
       m.sender_type, m.sender_user_id, m.sender_sub_user_id,
       COALESCE(m.sender_name, 'Member') AS sender_name,
       m.sender_avatar_url,
       m.has_attachments,
       m.message_type
FROM dm_gate, chat_messages m
WHERE m.channel_id = p_channel_id AND m.owner_id = p_owner_id
ORDER BY m.created_at ASC
$function$;