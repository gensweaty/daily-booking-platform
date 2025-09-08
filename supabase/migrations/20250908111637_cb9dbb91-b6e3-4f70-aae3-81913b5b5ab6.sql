-- Ensure file attachment functions properly update parent message flags

-- Update attach_files_to_message_public to ensure parent message gets has_attachments=true
CREATE OR REPLACE FUNCTION public.attach_files_to_message_public(p_owner_id uuid, p_channel_id uuid, p_sender_email text, p_files jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sub_id uuid;
  v_msg_id uuid;
begin
  -- resolve sub_user id
  select su.id into v_sub_id
  from sub_users su
  where su.board_owner_id = p_owner_id
    and lower(su.email) = lower(p_sender_email)
  limit 1;

  if v_sub_id is null then
    raise exception 'Unknown sender for owner % and email %', p_owner_id, p_sender_email;
  end if;

  -- latest message by that sender in that channel
  select cm.id into v_msg_id
  from chat_messages cm
  where cm.owner_id = p_owner_id
    and cm.channel_id = p_channel_id
    and cm.sender_sub_user_id = v_sub_id
  order by cm.created_at desc
  limit 1;

  if v_msg_id is null then
    raise exception 'No recent message to attach files to';
  end if;

  -- insert files
  insert into chat_message_files (message_id, filename, file_path, content_type, size)
  select v_msg_id,
         (f->>'filename')::text,
         (f->>'file_path')::text,
         (f->>'content_type')::text,
         nullif((f->>'size')::bigint, 0)
  from jsonb_array_elements(p_files) f;

  -- 🔧 CRITICAL: Update parent message flags AND trigger realtime UPDATE
  update chat_messages
  set 
    has_attachments = true, 
    message_type = 'file',
    updated_at = now()  -- This ensures UPDATE event is triggered
  where id = v_msg_id;
  
  raise notice '📎 Attached % files to message % and triggered UPDATE', jsonb_array_length(p_files), v_msg_id;
end
$function$;

-- Update attach_files_to_message_public_by_id to ensure parent message gets has_attachments=true
CREATE OR REPLACE FUNCTION public.attach_files_to_message_public_by_id(p_owner_id uuid, p_message_id uuid, p_files jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  f jsonb;
BEGIN
  -- Ensure the message belongs to this owner
  IF NOT EXISTS (SELECT 1 FROM chat_messages WHERE id = p_message_id AND owner_id = p_owner_id) THEN
    RAISE EXCEPTION 'Message not found or owner mismatch';
  END IF;

  FOR f IN SELECT * FROM jsonb_array_elements(p_files)
  LOOP
    INSERT INTO chat_message_files (id, message_id, filename, file_path, content_type, size)
    VALUES (
      gen_random_uuid(),
      p_message_id,
      (f->>'filename'),
      (f->>'file_path'),
      (f->>'content_type'),
      COALESCE((f->>'size')::bigint, NULL)
    );
  END LOOP;

  -- 🔧 CRITICAL: Update parent message flags AND trigger realtime UPDATE
  UPDATE chat_messages
  SET 
    has_attachments = true, 
    message_type = 'file',
    updated_at = now()  -- This ensures UPDATE event is triggered
  WHERE id = p_message_id;
  
  RAISE NOTICE '📎 Attached % files to message % and triggered UPDATE', jsonb_array_length(p_files), p_message_id;
END $function$;