-- Add email column to public_board_access table for external users
ALTER TABLE public_board_access ADD COLUMN external_user_email TEXT;