-- Fix peer counting to only include messages from channels where BOTH viewer and peer participate
CREATE OR REPLACE FUNCTION public.unread_counters(p_owner_id uuid, p_viewer_type text, p_viewer_id uuid)
 RETURNS TABLE(channel_id uuid, channel_unread integer, peer_id uuid, peer_type text, peer_unread integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with my_rows as (
    -- Use DISTINCT to handle duplicate participants
    select distinct cp.channel_id, cp.last_read_at
      from chat_participants cp
      join chat_channels cc on cc.id = cp.channel_id
     where cc.owner_id = p_owner_id
       and ((p_viewer_type = 'admin' and cp.user_type = 'admin' and cp.user_id = p_viewer_id)
         or (p_viewer_type = 'sub_user' and cp.user_type = 'sub_user' and cp.sub_user_id = p_viewer_id))
  ),
  msgs as (
    select m.channel_id, m.created_at,
           coalesce(m.sender_user_id, m.sender_sub_user_id) as sender_any_id,
           case when m.sender_user_id is not null then 'admin' else 'sub_user' end as sender_type
      from chat_messages m
     where m.owner_id = p_owner_id
       -- Don't count my own messages
       and not ((p_viewer_type = 'admin' and m.sender_user_id = p_viewer_id)
             or (p_viewer_type = 'sub_user' and m.sender_sub_user_id = p_viewer_id))
  ),
  channel_cte as (
    select r.channel_id,
           count(*)::int as channel_unread
      from msgs m
      join my_rows r on r.channel_id = m.channel_id and m.created_at > r.last_read_at
     group by r.channel_id
  ),
  peer_cte as (
    -- FIXED: Count messages from peers in ALL channels where BOTH viewer and peer participate
    select m.sender_any_id as peer_id,
           m.sender_type as peer_type,
           count(*)::int as peer_unread
      from msgs m
      join my_rows r on r.channel_id = m.channel_id and m.created_at > r.last_read_at
      -- CRITICAL: Only count if the message sender is also a participant in this channel
      where exists (
        select 1 from chat_participants cp2
        where cp2.channel_id = m.channel_id
          and ((m.sender_type = 'admin' and cp2.user_type = 'admin' and cp2.user_id = m.sender_any_id)
            or (m.sender_type = 'sub_user' and cp2.user_type = 'sub_user' and cp2.sub_user_id = m.sender_any_id))
      )
     group by m.sender_any_id, m.sender_type
  ),
  -- Add all channels the viewer participates in to ensure we return results
  all_my_channels as (
    select distinct cp.channel_id
      from chat_participants cp
      join chat_channels cc on cc.id = cp.channel_id
     where cc.owner_id = p_owner_id
       and ((p_viewer_type = 'admin' and cp.user_type = 'admin' and cp.user_id = p_viewer_id)
         or (p_viewer_type = 'sub_user' and cp.user_type = 'sub_user' and cp.sub_user_id = p_viewer_id))
  )
  select
    coalesce(c.channel_id, amc.channel_id) as channel_id,
    coalesce(c.channel_unread, 0) as channel_unread,
    p.peer_id,
    p.peer_type,
    coalesce(p.peer_unread, 0) as peer_unread
  from all_my_channels amc
  full outer join channel_cte c on c.channel_id = amc.channel_id
  full outer join peer_cte p on true; -- Cross join peers since they're now aggregated across all shared channels
$function$