-- Fix RLS policies for authenticated sub-user access to customers table
-- This ensures authenticated sub-users can delete customers they created

-- Update customers table RLS policies to allow authenticated sub-users
DROP POLICY IF EXISTS "Enable delete access for users" ON customers;
DROP POLICY IF EXISTS "Enable update access for users" ON customers;

-- Create improved delete policy for customers
CREATE POLICY "Enable delete access for users and public boards" ON customers
FOR DELETE
USING (
  -- Allow authenticated users to delete their own customers
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  -- Allow deletion on public boards
  (user_id IN (
    SELECT public_boards.user_id
    FROM public_boards
    WHERE public_boards.is_active = true
  ))
);

-- Create improved update policy for customers
CREATE POLICY "Enable update access for users and public boards" ON customers
FOR UPDATE
USING (
  -- Allow authenticated users to update their own customers
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  -- Allow updates on public boards
  (user_id IN (
    SELECT public_boards.user_id
    FROM public_boards
    WHERE public_boards.is_active = true
  ))
);

-- Ensure tasks table has proper policies for authenticated sub-users
DROP POLICY IF EXISTS "Enable delete access for users" ON tasks;
DROP POLICY IF EXISTS "Enable update access for users" ON tasks;

-- Create improved delete policy for tasks
CREATE POLICY "Enable delete access for users and public boards" ON tasks
FOR DELETE
USING (
  -- Allow authenticated users to delete tasks on their boards
  auth.uid() = user_id OR
  -- Allow deletion on public boards (for external users)
  (user_id IN (
    SELECT public_boards.user_id
    FROM public_boards
    WHERE public_boards.is_active = true
  ))
);

-- Create improved update policy for tasks
CREATE POLICY "Enable update access for users and public boards" ON tasks
FOR UPDATE
USING (
  -- Allow authenticated users to update tasks on their boards
  auth.uid() = user_id OR
  -- Allow updates on public boards (for external users)
  (user_id IN (
    SELECT public_boards.user_id
    FROM public_boards
    WHERE public_boards.is_active = true
  ))
);