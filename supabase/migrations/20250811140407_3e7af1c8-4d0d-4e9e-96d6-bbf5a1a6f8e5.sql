-- Update task stats RPC to exclude archived tasks for accurate Statistics
CREATE OR REPLACE FUNCTION public.get_task_stats(user_id_param uuid)
RETURNS TABLE(total bigint, completed bigint, in_progress bigint, todo bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'done') AS completed,
    COUNT(*) FILTER (WHERE status = 'inprogress') AS in_progress,
    COUNT(*) FILTER (WHERE status = 'todo') AS todo
  FROM tasks 
  WHERE user_id = user_id_param
    AND (archived = false OR archived IS NULL)
    AND archived_at IS NULL;
$function$;