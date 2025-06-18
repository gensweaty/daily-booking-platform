
-- First, let's clean up existing group events by setting individual fields to NULL
-- This will ensure group events only have group-specific data
UPDATE events 
SET 
  user_surname = NULL,
  user_number = NULL, 
  social_network_link = NULL,
  event_notes = NULL,
  payment_status = NULL,
  payment_amount = NULL
WHERE is_group_event = true;

-- Ensure group events have proper group_name from title if missing
UPDATE events 
SET group_name = title 
WHERE is_group_event = true AND (group_name IS NULL OR group_name = '');
