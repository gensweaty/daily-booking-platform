-- Revert get_public_events_by_user_id to original version (before excluded_from_series filter)
CREATE OR REPLACE FUNCTION public.get_public_events_by_user_id(user_id_param uuid)
RETURNS SETOF events
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM events
  WHERE user_id = user_id_param
    AND deleted_at IS NULL
  ORDER BY start_date ASC;
$$;