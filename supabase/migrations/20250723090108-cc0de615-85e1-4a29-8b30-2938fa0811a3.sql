
-- Create the missing atomic delete function for events and related booking requests
CREATE OR REPLACE FUNCTION public.delete_event_and_related_booking(
  p_event_id uuid,
  p_user_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_booking_id uuid;
  v_business_id uuid;
  v_deleted_count integer := 0;
BEGIN
  -- First try to find and delete as an event
  SELECT booking_request_id INTO v_booking_id
  FROM events 
  WHERE id = p_event_id AND user_id = p_user_id AND deleted_at IS NULL;
  
  IF FOUND THEN
    -- Soft delete the event
    UPDATE events 
    SET deleted_at = NOW()
    WHERE id = p_event_id AND user_id = p_user_id;
    
    v_deleted_count := v_deleted_count + 1;
    
    -- If this event was created from a booking request, also delete that
    IF v_booking_id IS NOT NULL THEN
      UPDATE booking_requests
      SET deleted_at = NOW(), status = 'rejected'
      WHERE id = v_booking_id;
      
      v_deleted_count := v_deleted_count + 1;
    END IF;
    
    -- Delete any recurring child events
    UPDATE events
    SET deleted_at = NOW()
    WHERE parent_event_id = p_event_id AND user_id = p_user_id;
    
  ELSE
    -- Try to find and delete as a booking request
    SELECT business_id INTO v_business_id
    FROM booking_requests br
    JOIN business_profiles bp ON br.business_id = bp.id
    WHERE br.id = p_event_id 
    AND bp.user_id = p_user_id 
    AND br.deleted_at IS NULL;
    
    IF FOUND THEN
      -- Soft delete the booking request
      UPDATE booking_requests
      SET deleted_at = NOW(), status = 'rejected'
      WHERE id = p_event_id;
      
      v_deleted_count := v_deleted_count + 1;
      
      -- Also delete any event created from this booking
      UPDATE events
      SET deleted_at = NOW()
      WHERE booking_request_id = p_event_id AND user_id = p_user_id;
      
    END IF;
  END IF;
  
  RETURN v_deleted_count;
END;
$function$;

-- Clean up the existing ghost data
UPDATE booking_requests 
SET deleted_at = NOW(), status = 'rejected'
WHERE title = 'sadasdasdsad' AND deleted_at IS NULL;
