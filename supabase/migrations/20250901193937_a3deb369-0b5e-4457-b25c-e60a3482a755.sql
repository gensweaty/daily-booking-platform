-- Create RPC function for attaching files to messages on public boards
create or replace function public.attach_files_to_message_public(
  p_owner_id uuid,
  p_channel_id uuid,
  p_sender_email text,
  p_files jsonb  -- [{filename,file_path,content_type,size}, ...]
) returns void
language plpgsql
security definer
set search_path = public
as $$
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

  -- flip flags on message
  update chat_messages
  set has_attachments = true, message_type = 'file'
  where id = v_msg_id;
end
$$;

-- Create RPC function for sending authenticated messages (admin users)
create or replace function public.send_authenticated_message(
  p_channel_id uuid,
  p_owner_id uuid,
  p_content text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert message for authenticated admin user
  insert into chat_messages (
    channel_id,
    owner_id,
    sender_type,
    sender_user_id,
    sender_name,
    sender_avatar_url,
    content
  ) values (
    p_channel_id,
    p_owner_id,
    'admin',
    auth.uid(),
    coalesce(
      (select username from profiles where id = auth.uid()),
      (select email from auth.users where id = auth.uid())
    ),
    (select avatar_url from profiles where id = auth.uid()),
    p_content
  );

  -- Update channel's last activity
  update chat_channels 
  set updated_at = now() 
  where id = p_channel_id;
end
$$;

-- Create RPC function for getting chat messages for a channel
create or replace function public.get_chat_messages_for_channel(
  p_board_owner_id uuid,
  p_channel_id uuid
) returns table (
  id uuid,
  content text,
  created_at timestamptz,
  sender_user_id uuid,
  sender_sub_user_id uuid,
  sender_type text,
  sender_name text,
  sender_avatar_url text,
  channel_id uuid,
  has_attachments boolean,
  message_type text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select 
    cm.id,
    cm.content,
    cm.created_at,
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
$$;