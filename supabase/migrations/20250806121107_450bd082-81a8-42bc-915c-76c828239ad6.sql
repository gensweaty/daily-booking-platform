-- Add external_user_email column to tasks table for tracking email addresses of external users
ALTER TABLE tasks ADD COLUMN external_user_email TEXT;