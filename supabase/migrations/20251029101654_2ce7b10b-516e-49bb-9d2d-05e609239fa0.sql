-- Fix events with NULL user_id by setting them to the admin user
-- This will allow event reminders to work properly
UPDATE events 
SET user_id = 'd4c70ae3-46a5-4824-b6a1-d63cc1f78bf4'
WHERE user_id IS NULL;