
-- Add deleted_at column to booking_requests table
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
