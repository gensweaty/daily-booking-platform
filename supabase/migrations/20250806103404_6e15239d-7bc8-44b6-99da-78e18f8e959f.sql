-- Fix the get_public_board_tasks function to use correct column names
CREATE OR REPLACE FUNCTION public.get_public_board_tasks(board_user_id uuid)
 RETURNS SETOF tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT * FROM public.tasks
  WHERE user_id = board_user_id
  AND archived = false
  AND archived_at IS NULL
  ORDER BY created_at DESC;
END;
$function$