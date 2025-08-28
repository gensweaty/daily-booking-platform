-- Fix the unique constraint to match the upsert specification
DROP INDEX IF EXISTS sub_users_owner_email_uniq;

-- Create a proper unique constraint that matches the upsert onConflict
ALTER TABLE public.sub_users 
ADD CONSTRAINT sub_users_board_owner_email_key 
UNIQUE (board_owner_id, email);