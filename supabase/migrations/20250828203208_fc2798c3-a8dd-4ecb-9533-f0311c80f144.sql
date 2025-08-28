-- Make sure General is never a DM
UPDATE public.chat_channels 
SET is_dm = false, is_private = false
WHERE is_default = true OR lower(name) = 'general';

-- Create unique index for sub_users to enable safe upserts
CREATE UNIQUE INDEX IF NOT EXISTS sub_users_owner_email_uniq
ON public.sub_users (board_owner_id, lower(email));