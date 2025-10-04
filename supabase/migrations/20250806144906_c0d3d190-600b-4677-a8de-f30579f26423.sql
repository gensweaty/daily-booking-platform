-- Update RLS policies for task_comments to allow external users to comment
-- Drop existing policies
DROP POLICY IF EXISTS "Users can create comments for their tasks" ON task_comments;
DROP POLICY IF EXISTS "Users can view comments for their tasks" ON task_comments;
DROP POLICY IF EXISTS "Users can update comments for their tasks" ON task_comments;
DROP POLICY IF EXISTS "Users can delete comments for their tasks" ON task_comments;

-- Create new policies that allow both task owners and external users
-- Allow task owners and external users to view comments
CREATE POLICY "Allow viewing comments for task access" ON task_comments
  FOR SELECT 
  USING (
    task_id IN (
      SELECT tasks.id 
      FROM tasks 
      WHERE tasks.user_id = auth.uid()
        OR tasks.id IN (
          SELECT DISTINCT t.id 
          FROM tasks t 
          WHERE t.user_id IS NOT NULL
        )
    )
  );

-- Allow task owners and external users to create comments
CREATE POLICY "Allow creating comments for accessible tasks" ON task_comments
  FOR INSERT 
  WITH CHECK (
    task_id IN (
      SELECT tasks.id 
      FROM tasks 
      WHERE tasks.user_id = auth.uid()
        OR tasks.id IN (
          SELECT DISTINCT t.id 
          FROM tasks t 
          WHERE t.user_id IS NOT NULL
        )
    )
  );

-- Allow only task owners to update comments
CREATE POLICY "Allow updating comments for own tasks" ON task_comments
  FOR UPDATE 
  USING (
    task_id IN (
      SELECT tasks.id 
      FROM tasks 
      WHERE tasks.user_id = auth.uid()
    )
  );

-- Allow only task owners to delete comments
CREATE POLICY "Allow deleting comments for own tasks" ON task_comments
  FOR DELETE 
  USING (
    task_id IN (
      SELECT tasks.id 
      FROM tasks 
      WHERE tasks.user_id = auth.uid()
    )
  );