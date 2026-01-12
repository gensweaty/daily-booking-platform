-- Add tasks_permission column to sub_users table
ALTER TABLE public.sub_users 
ADD COLUMN IF NOT EXISTS tasks_permission boolean DEFAULT true;

-- Update existing sub_users to have tasks_permission enabled by default
UPDATE public.sub_users SET tasks_permission = true WHERE tasks_permission IS NULL;