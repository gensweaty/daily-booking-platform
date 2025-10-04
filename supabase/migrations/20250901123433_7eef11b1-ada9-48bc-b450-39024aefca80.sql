-- Create RLS-safe function for sub-users to get their DM channels
CREATE OR REPLACE FUNCTION public.get_dm_channels_for_sub_user(
  p_owner_id uuid,
  p_email text
) 
RETURNS TABLE (
  channel_id uuid,
  other_type text,
  other_user_id uuid,
  other_sub_user_id uuid
) 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public
AS $$
  WITH me AS (
    SELECT su.id as sub_user_id
    FROM sub_users su
    WHERE su.board_owner_id = p_owner_id 
      AND lower(su.email) = lower(p_email)
    LIMIT 1
  )
  SELECT
    c.id as channel_id,
    CASE WHEN cp.user_type = 'admin' THEN 'admin' ELSE 'sub_user' END as other_type,
    cp.user_id as other_user_id,
    cp.sub_user_id as other_sub_user_id
  FROM chat_channels c
  JOIN chat_participants cp ON cp.channel_id = c.id
  WHERE c.owner_id = p_owner_id
    AND c.is_dm = true
    AND EXISTS (
      SELECT 1 FROM chat_participants mine
      JOIN me ON true
      WHERE mine.channel_id = c.id
        AND mine.user_type = 'sub_user'
        AND mine.sub_user_id = me.sub_user_id
    )
    AND NOT (
      -- filter out "me"
      cp.user_type = 'sub_user'
      AND cp.sub_user_id = (SELECT sub_user_id FROM me)
    );
$$;