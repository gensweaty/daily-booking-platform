-- Create public_boards table for managing public task boards
CREATE TABLE public.public_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  magic_word TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create public_board_access table for tracking external user access
CREATE TABLE public.public_board_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.public_boards(id) ON DELETE CASCADE,
  external_user_name TEXT NOT NULL,
  access_token TEXT NOT NULL UNIQUE,
  last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add metadata tracking columns to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by_type TEXT DEFAULT 'admin';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS last_edited_by_type TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS last_edited_by_name TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS on new tables
ALTER TABLE public.public_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_board_access ENABLE ROW LEVEL SECURITY;

-- Create policies for public_boards
CREATE POLICY "Users can create their own public boards" 
ON public.public_boards 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own public boards" 
ON public.public_boards 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own public boards" 
ON public.public_boards 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own public boards" 
ON public.public_boards 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for public_board_access
CREATE POLICY "Board owners can view access logs" 
ON public.public_board_access 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.public_boards 
    WHERE id = public_board_access.board_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Allow public board access creation" 
ON public.public_board_access 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public board access updates" 
ON public.public_board_access 
FOR UPDATE 
USING (true);

-- Create function to update tasks updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_task_metadata()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.last_edited_by_type IS NOT NULL THEN
    NEW.last_edited_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tasks metadata updates
DROP TRIGGER IF EXISTS update_task_metadata_trigger ON public.tasks;
CREATE TRIGGER update_task_metadata_trigger
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_task_metadata();

-- Create function to get public board by access token
CREATE OR REPLACE FUNCTION public.get_public_board_by_token(access_token_param TEXT)
RETURNS TABLE(
  board_id UUID,
  user_id UUID,
  magic_word TEXT,
  is_active BOOLEAN,
  external_user_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pb.id as board_id,
    pb.user_id,
    pb.magic_word,
    pb.is_active,
    pba.external_user_name
  FROM public.public_boards pb
  JOIN public.public_board_access pba ON pb.id = pba.board_id
  WHERE pba.access_token = access_token_param
  AND pb.is_active = true;
END;
$$;

-- Create function to get tasks for public board
CREATE OR REPLACE FUNCTION public.get_public_board_tasks(board_user_id UUID)
RETURNS SETOF public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.tasks
  WHERE user_id = board_user_id
  AND archived = false
  AND deleted_at IS NULL
  ORDER BY created_at DESC;
END;
$$;