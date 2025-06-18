
-- Phase 2: Data Cleanup - Fix corrupted database records
-- Set user_surname = NULL for all group events (where is_group_event = true)
UPDATE events 
SET user_surname = NULL, 
    user_number = NULL, 
    social_network_link = NULL, 
    event_notes = NULL,
    payment_status = NULL,
    payment_amount = NULL
WHERE is_group_event = true 
AND (user_surname IS NOT NULL OR user_number IS NOT NULL OR social_network_link IS NOT NULL 
     OR event_notes IS NOT NULL OR payment_status IS NOT NULL OR payment_amount IS NOT NULL);

-- Set group_name = NULL for all individual events (where is_group_event = false OR is_group_event IS NULL)
UPDATE events 
SET group_name = NULL
WHERE (is_group_event = false OR is_group_event IS NULL) 
AND group_name IS NOT NULL;

-- Ensure title matches the appropriate field based on event type
UPDATE events 
SET title = group_name 
WHERE is_group_event = true AND group_name IS NOT NULL AND title != group_name;

UPDATE events 
SET title = user_surname 
WHERE (is_group_event = false OR is_group_event IS NULL) AND user_surname IS NOT NULL AND title != user_surname;
