
-- Update the get_public_events_by_user_id function to handle deleted events properly
CREATE OR REPLACE FUNCTION public.get_public_events_by_user_id(user_id_param uuid)
 RETURNS SETOF events
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM events 
  WHERE user_id = user_id_param
  AND deleted_at IS NULL
  ORDER BY start_date ASC;
$function$;

-- Create a new function to get all calendar data (events + booking requests) for a business
-- This ensures the external calendar gets the exact same data as the internal calendar
CREATE OR REPLACE FUNCTION public.get_public_calendar_events(business_id_param uuid)
 RETURNS TABLE(
   event_id uuid,
   event_title text,
   event_start_date timestamp with time zone,
   event_end_date timestamp with time zone,
   event_type text,
   event_user_id uuid,
   event_user_surname text,
   event_user_number text,
   event_social_network_link text,
   event_notes text,
   event_payment_status text,
   event_payment_amount numeric,
   event_language text,
   event_created_at timestamp with time zone,
   event_deleted_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  business_user_id uuid;
BEGIN
  -- Get the business owner's user ID
  SELECT user_id INTO business_user_id
  FROM business_profiles
  WHERE id = business_id_param;
  
  IF business_user_id IS NULL THEN
    RAISE EXCEPTION 'Business not found: %', business_id_param;
  END IF;

  -- Return ALL events from the events table (this includes all types of events)
  -- regular events, recurring events, CRM-created events, etc.
  RETURN QUERY
  SELECT 
    e.id as event_id,
    e.title as event_title,
    e.start_date as event_start_date,
    e.end_date as event_end_date,
    COALESCE(e.type, 'event') as event_type,
    e.user_id as event_user_id,
    e.user_surname as event_user_surname,
    e.user_number as event_user_number,
    e.social_network_link as event_social_network_link,
    e.event_notes as event_notes,
    e.payment_status as event_payment_status,
    e.payment_amount as event_payment_amount,
    COALESCE(e.language, 'en') as event_language,
    e.created_at as event_created_at,
    e.deleted_at as event_deleted_at
  FROM events e
  WHERE e.user_id = business_user_id
    AND e.deleted_at IS NULL  -- Only non-deleted events
  
  UNION ALL
  
  -- Return approved booking requests as events ONLY if they don't have corresponding events
  SELECT 
    br.id as event_id,
    br.title as event_title,
    br.start_date as event_start_date,
    br.end_date as event_end_date,
    'booking_request' as event_type,
    br.user_id as event_user_id,
    br.requester_name as event_user_surname,
    br.requester_phone as event_user_number,
    br.requester_email as event_social_network_link,
    br.description as event_notes,
    br.payment_status as event_payment_status,
    br.payment_amount as event_payment_amount,
    COALESCE(br.language, 'en') as event_language,
    br.created_at as event_created_at,
    br.deleted_at as event_deleted_at
  FROM booking_requests br
  WHERE br.business_id = business_id_param
    AND br.status = 'approved'  -- Only approved bookings
    AND br.deleted_at IS NULL   -- Only non-deleted bookings
    AND NOT EXISTS (            -- Only if no corresponding event exists
      SELECT 1 FROM events e2 
      WHERE e2.booking_request_id = br.id 
      AND e2.deleted_at IS NULL
    )
  
  ORDER BY event_start_date ASC;
END;
$function$;

-- Create atomic delete function for events and related booking requests
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
