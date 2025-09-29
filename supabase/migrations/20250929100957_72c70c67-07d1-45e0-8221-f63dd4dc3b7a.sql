-- B) Fix list_channel_messages_public access for General / non-DM channels
CREATE OR REPLACE FUNCTION public.list_channel_messages_public(p_owner_id uuid, p_channel_id uuid, p_requester_type text, p_requester_email text)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, updated_at timestamp with time zone, edited_at timestamp with time zone, original_content text, channel_id uuid, sender_type text, sender_user_id uuid, sender_sub_user_id uuid, sender_name text, sender_avatar_url text, has_attachments boolean, message_type text, is_deleted boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Find out if the channel is a DM
  PERFORM 1 FROM chat_channels
  WHERE id = p_channel_id AND owner_id = p_owner_id AND is_dm = true;

  IF FOUND THEN
    -- DM: require that the requester is a participant
    IF NOT EXISTS (
      SELECT 1
      FROM chat_participants cp
      JOIN sub_users su ON su.id = cp.sub_user_id
      WHERE cp.channel_id = p_channel_id
        AND su.board_owner_id = p_owner_id
        AND lower(su.email) = lower(p_requester_email)
        AND cp.user_type = 'sub_user'
    ) THEN
      RETURN;
    END IF;
  ELSE
    -- Non-DM: allow any sub-user under this owner to read
    IF NOT EXISTS (
      SELECT 1
      FROM sub_users su
      WHERE su.board_owner_id = p_owner_id
        AND lower(su.email) = lower(p_requester_email)
    ) THEN
      RETURN;
    END IF;
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
$function$;