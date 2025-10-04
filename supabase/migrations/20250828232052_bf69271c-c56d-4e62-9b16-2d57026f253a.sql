-- A. Database guarantees (one migration)

-- A.1 Make sub_users(board_owner_id, email) unique (matches your upserts and prevents dupes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname='public' 
      AND indexname='sub_users_owner_email_key'
  ) THEN
    CREATE UNIQUE INDEX sub_users_owner_email_key 
      ON public.sub_users (board_owner_id, lower(email));
  END IF;
END$$;

-- A.2 Enforce peer-to-peer DMs (exactly two participants): remove the owner from DMs that accidentally got 3 participants
DELETE FROM public.chat_participants cp
USING public.chat_channels ch
WHERE cp.channel_id = ch.id
  AND ch.is_dm = TRUE
  AND cp.user_id = ch.owner_id
  AND (
    SELECT COUNT(*) 
    FROM public.chat_participants x 
    WHERE x.channel_id = ch.id
  ) > 2;

-- A.2b Normalize JSON participants to 2 ids (other + other)
UPDATE public.chat_channels ch
SET participants = (
  SELECT jsonb_agg(x) 
  FROM (
    SELECT DISTINCT COALESCE(cp.user_id, cp.sub_user_id)::text AS x
    FROM public.chat_participants cp 
    WHERE cp.channel_id = ch.id
    ORDER BY x
    LIMIT 2
  ) s
)
WHERE ch.is_dm = TRUE;

-- A.3 Admin display helper (to avoid "user_xxx")
CREATE OR REPLACE FUNCTION public.get_admin_display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT 
    CASE 
      WHEN p.username IS NULL OR p.username = '' THEN 'Admin'
      WHEN p.username LIKE 'user_%' THEN COALESCE(split_part(au.email, '@', 1), 'Admin')
      ELSE p.username
    END
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE p.id = p_user_id
$$;