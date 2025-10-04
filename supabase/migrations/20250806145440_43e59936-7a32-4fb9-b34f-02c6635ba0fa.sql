-- Fix RLS policies for task_comments to properly handle external users
-- Drop existing policies
DROP POLICY IF EXISTS "Allow creating comments for accessible tasks" ON task_comments;
DROP POLICY IF EXISTS "Allow viewing comments for task access" ON task_comments;
DROP POLICY IF EXISTS "Allow updating comments for own tasks" ON task_comments;
DROP POLICY IF EXISTS "Allow deleting comments for own tasks" ON task_comments;

-- Create new policies that properly handle both authenticated and external users
-- Allow viewing comments for accessible tasks (authenticated users + public access)
CREATE POLICY "Allow viewing task comments" ON task_comments
  FOR SELECT 
  USING (
    -- Allow if user owns the task
    (auth.uid() IS NOT NULL AND task_id IN (
      SELECT id FROM tasks WHERE user_id = auth.uid()
    ))
    OR
    -- Allow public access to any task (for external users)
    (task_id IN (
      SELECT id FROM tasks WHERE user_id IS NOT NULL
    ))
  );

-- Allow creating comments for accessible tasks (authenticated users + public access)
CREATE POLICY "Allow creating task comments" ON task_comments
  FOR INSERT 
  WITH CHECK (
    -- Allow if user owns the task
    (auth.uid() IS NOT NULL AND task_id IN (
      SELECT id FROM tasks WHERE user_id = auth.uid()
    ))
    OR
    -- Allow public access to create comments on any task (for external users)
    (task_id IN (
      SELECT id FROM tasks WHERE user_id IS NOT NULL
    ))
  );

-- Allow updating comments only for task owners (authenticated users only)
CREATE POLICY "Allow updating task comments" ON task_comments
  FOR UPDATE 
  USING (
    auth.uid() IS NOT NULL AND task_id IN (
      SELECT id FROM tasks WHERE user_id = auth.uid()
    )
  );

-- Allow deleting comments only for task owners (authenticated users only)
CREATE POLICY "Allow deleting task comments" ON task_comments
  FOR DELETE 
  USING (
    auth.uid() IS NOT NULL AND task_id IN (
      SELECT id FROM tasks WHERE user_id = auth.uid()
    )
  );