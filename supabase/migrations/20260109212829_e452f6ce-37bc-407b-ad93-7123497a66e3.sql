-- Add avatar_url column to business_profiles table for business logo/avatar
ALTER TABLE public.business_profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;