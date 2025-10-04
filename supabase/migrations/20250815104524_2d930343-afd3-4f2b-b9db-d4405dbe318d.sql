-- Add avatar_url column to sub_users table
ALTER TABLE public.sub_users 
ADD COLUMN avatar_url TEXT;