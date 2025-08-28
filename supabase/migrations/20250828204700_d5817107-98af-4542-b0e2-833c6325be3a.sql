-- Remove the duplicate constraint I created
ALTER TABLE public.sub_users 
DROP CONSTRAINT IF EXISTS sub_users_board_owner_email_key;

-- The existing unique_email_per_owner constraint should handle this