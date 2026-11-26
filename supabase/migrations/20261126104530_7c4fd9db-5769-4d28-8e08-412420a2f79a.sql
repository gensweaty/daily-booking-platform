CREATE OR REPLACE FUNCTION public.get_sub_user_auth(p_owner_id uuid, p_email text)
 RETURNS TABLE(id uuid, fullname text, email text, password_hash text, password_salt text)
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT id, fullname, email, NULL::text, NULL::text
  FROM public.sub_users
  WHERE board_owner_id = p_owner_id AND lower(email) = lower(p_email)
  LIMIT 1;
$function$;