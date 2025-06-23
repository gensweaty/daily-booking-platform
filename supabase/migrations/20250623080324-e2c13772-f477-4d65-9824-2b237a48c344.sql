
-- Add optional deadline and reminder fields to tasks table
ALTER TABLE public.tasks 
ADD COLUMN deadline_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN reminder_at TIMESTAMP WITH TIME ZONE;
