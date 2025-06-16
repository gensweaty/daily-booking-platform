
-- Create optimized function for task statistics
CREATE OR REPLACE FUNCTION get_task_stats(user_id_param UUID)
RETURNS TABLE(
  total BIGINT,
  completed BIGINT,
  in_progress BIGINT,
  todo BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'done') as completed,
    COUNT(*) FILTER (WHERE status = 'inprogress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'todo') as todo
  FROM tasks 
  WHERE user_id = user_id_param;
$$;
