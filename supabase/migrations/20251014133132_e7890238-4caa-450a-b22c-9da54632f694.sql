-- One-time cleanup: fix already-created tasks with wrong status
UPDATE public.tasks
SET status = 'inprogress'
WHERE status IN ('in_progress', 'in-progress');