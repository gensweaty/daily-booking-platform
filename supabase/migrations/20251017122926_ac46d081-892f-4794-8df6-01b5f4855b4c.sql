-- Add sender_email and business_name columns to scheduled_emails table
ALTER TABLE public.scheduled_emails 
ADD COLUMN IF NOT EXISTS sender_email text,
ADD COLUMN IF NOT EXISTS business_name text;

-- Add helpful comment
COMMENT ON COLUMN public.scheduled_emails.sender_email IS 'Email address of the user/sub-user sending the email';
COMMENT ON COLUMN public.scheduled_emails.business_name IS 'Business name if sender has a business profile';