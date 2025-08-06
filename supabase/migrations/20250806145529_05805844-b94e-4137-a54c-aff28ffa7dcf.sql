-- Fix RLS policies for comment_files to properly handle external users
-- Drop existing policies  
DROP POLICY IF EXISTS "Users can view comment files for their tasks" ON comment_files;
DROP POLICY IF EXISTS "Users can upload comment files for their tasks" ON comment_files;
DROP POLICY IF EXISTS "Users can delete comment files for their tasks" ON comment_files;

-- Create new policies that properly handle both authenticated and external users
-- Allow viewing comment files for accessible tasks (authenticated users + public access)
CREATE POLICY "Allow viewing comment files" ON comment_files
  FOR SELECT 
  USING (
    -- Allow if user owns the task through comment
    (auth.uid() IS NOT NULL AND comment_id IN (
      SELECT tc.id FROM task_comments tc 
      JOIN tasks t ON tc.task_id = t.id 
      WHERE t.user_id = auth.uid()
    ))
    OR
    -- Allow public access to view comment files on any task (for external users)
    (comment_id IN (
      SELECT tc.id FROM task_comments tc 
      JOIN tasks t ON tc.task_id = t.id 
      WHERE t.user_id IS NOT NULL
    ))
  );

-- Allow uploading comment files for accessible tasks (authenticated users + public access)
CREATE POLICY "Allow uploading comment files" ON comment_files
  FOR INSERT 
  WITH CHECK (
    -- Allow if user owns the task through comment
    (auth.uid() IS NOT NULL AND comment_id IN (
      SELECT tc.id FROM task_comments tc 
      JOIN tasks t ON tc.task_id = t.id 
      WHERE t.user_id = auth.uid()
    ))
    OR
    -- Allow public access to upload comment files on any task (for external users)
    (comment_id IN (
      SELECT tc.id FROM task_comments tc 
      JOIN tasks t ON tc.task_id = t.id 
      WHERE t.user_id IS NOT NULL
    ))
  );

-- Allow deleting comment files only for task owners (authenticated users only)
CREATE POLICY "Allow deleting comment files" ON comment_files
  FOR DELETE 
  USING (
    auth.uid() IS NOT NULL AND comment_id IN (
      SELECT tc.id FROM task_comments tc 
      JOIN tasks t ON tc.task_id = t.id 
      WHERE t.user_id = auth.uid()
    )
  );