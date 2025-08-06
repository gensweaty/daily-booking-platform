-- Enable RLS on task_comments table 
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Enable RLS on comment_files table if it exists
ALTER TABLE public.comment_files ENABLE ROW LEVEL SECURITY;