-- Enhanced RPC function for team members with improved name resolution
CREATE OR REPLACE FUNCTION get_team_members_for_board(p_board_owner_id UUID)
RETURNS TABLE(id UUID, name TEXT, type TEXT, avatar_url TEXT) AS $$
BEGIN
  RETURN QUERY
  -- Always include the owner with enhanced name resolution  
  SELECT p.id,
         CASE 
           WHEN p.username IS NULL THEN 'Admin'
           WHEN p.username LIKE 'user_%' THEN 
             COALESCE(
               SPLIT_PART(au.email, '@', 1),
               SUBSTRING(p.username FROM 6),  -- Extract part after 'user_'
               'Admin'
             )
           ELSE p.username
         END AS name,
         'admin'::text AS type,
         p.avatar_url
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE p.id = p_board_owner_id

  UNION ALL

  -- And all sub-users of this board with enhanced name resolution
  SELECT su.id,
         COALESCE(
           NULLIF(su.fullname, ''),
           SPLIT_PART(su.email, '@', 1),
           'Member'
         ) AS name,
         'sub_user'::text AS type,
         su.avatar_url
  FROM sub_users su
  WHERE su.board_owner_id = p_board_owner_id
  ORDER BY type DESC, name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;