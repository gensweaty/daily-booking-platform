-- Fix get_public_events_by_user_id to filter out exclusion markers
CREATE OR REPLACE FUNCTION public.get_public_events_by_user_id(user_id_param uuid)
RETURNS SETOF events
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT * FROM events 
  WHERE user_id = user_id_param
    AND deleted_at IS NULL
    AND (excluded_from_series IS NULL OR excluded_from_series = false)
  ORDER BY start_date ASC;
$function$;