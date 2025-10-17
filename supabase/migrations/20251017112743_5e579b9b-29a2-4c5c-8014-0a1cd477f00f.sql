-- Create scheduled_emails table for storing emails to be sent at specific times
CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  language text DEFAULT 'en',
  sender_name text,
  send_at timestamptz NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_type text DEFAULT 'admin',
  created_by_name text,
  deleted_at timestamptz
);

-- Enable RLS
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Policy for users to manage their own scheduled emails
CREATE POLICY "Users can manage their own scheduled emails"
ON public.scheduled_emails
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Index for efficient querying of due emails
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_send_at 
ON public.scheduled_emails(send_at) 
WHERE sent_at IS NULL AND deleted_at IS NULL;