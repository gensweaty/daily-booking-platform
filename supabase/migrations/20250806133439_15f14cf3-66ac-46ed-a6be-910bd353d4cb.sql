-- Create task_comments table
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID,
  created_by_name TEXT,
  created_by_type TEXT DEFAULT 'admin',
  last_edited_by_name TEXT,
  last_edited_by_type TEXT,
  last_edited_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create comment_files table for file attachments
CREATE TABLE public.comment_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_type TEXT,
  size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id UUID
);

-- Enable Row Level Security
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_files ENABLE ROW LEVEL SECURITY;

-- Create policies for task_comments
CREATE POLICY "Users can view comments for their tasks" 
ON public.task_comments 
FOR SELECT 
USING (
  task_id IN (
    SELECT id FROM public.tasks WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create comments for their tasks" 
ON public.task_comments 
FOR INSERT 
WITH CHECK (
  task_id IN (
    SELECT id FROM public.tasks WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update comments for their tasks" 
ON public.task_comments 
FOR UPDATE 
USING (
  task_id IN (
    SELECT id FROM public.tasks WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete comments for their tasks" 
ON public.task_comments 
FOR DELETE 
USING (
  task_id IN (
    SELECT id FROM public.tasks WHERE user_id = auth.uid()
  )
);

-- Create policies for comment_files
CREATE POLICY "Users can view comment files for their tasks" 
ON public.comment_files 
FOR SELECT 
USING (
  comment_id IN (
    SELECT tc.id FROM public.task_comments tc 
    JOIN public.tasks t ON tc.task_id = t.id 
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload comment files for their tasks" 
ON public.comment_files 
FOR INSERT 
WITH CHECK (
  comment_id IN (
    SELECT tc.id FROM public.task_comments tc 
    JOIN public.tasks t ON tc.task_id = t.id 
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete comment files for their tasks" 
ON public.comment_files 
FOR DELETE 
USING (
  comment_id IN (
    SELECT tc.id FROM public.task_comments tc 
    JOIN public.tasks t ON tc.task_id = t.id 
    WHERE t.user_id = auth.uid()
  )
);

-- Create trigger for updating updated_at
CREATE OR REPLACE FUNCTION public.update_task_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.last_edited_by_type IS NOT NULL THEN
        NEW.last_edited_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_comments_updated_at
BEFORE UPDATE ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_task_comments_updated_at();

-- Add indexes for performance
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_task_comments_created_at ON public.task_comments(created_at);
CREATE INDEX idx_comment_files_comment_id ON public.comment_files(comment_id);