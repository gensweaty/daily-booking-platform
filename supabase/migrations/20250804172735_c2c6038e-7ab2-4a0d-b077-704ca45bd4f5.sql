-- Add reminder fields to events table
ALTER TABLE public.events 
ADD COLUMN reminder_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN email_reminder_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN reminder_sent_at TIMESTAMP WITH TIME ZONE;