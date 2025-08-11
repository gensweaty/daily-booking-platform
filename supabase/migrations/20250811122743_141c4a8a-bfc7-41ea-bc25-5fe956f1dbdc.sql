-- Add password columns for sub_users to support board-specific authentication
ALTER TABLE public.sub_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_salt TEXT;

-- Optional: index to speed up lookups by owner and email
CREATE INDEX IF NOT EXISTS idx_sub_users_owner_email ON public.sub_users (board_owner_id, email);
