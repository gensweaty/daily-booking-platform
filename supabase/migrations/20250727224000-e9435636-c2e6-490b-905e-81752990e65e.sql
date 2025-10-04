
-- Add language column to profiles table to store user language preference
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Update the column to have a check constraint for valid languages
ALTER TABLE public.profiles ADD CONSTRAINT valid_language CHECK (language IN ('en', 'es', 'ka'));

-- Create an index for better performance when querying by language
CREATE INDEX IF NOT EXISTS idx_profiles_language ON public.profiles(language);
