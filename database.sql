
-- Update the save_event_with_persons function to handle reminder_time
CREATE OR REPLACE FUNCTION public.save_event_with_persons(p_event_data jsonb, p_additional_persons jsonb, p_user_id uuid, p_event_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_event_id UUID;
  v_person JSONB;
  v_safe_title TEXT;
  v_safe_user_surname TEXT;
  v_is_recurring BOOLEAN;
  v_repeat_pattern TEXT;
  v_repeat_until DATE;
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_reminder_time TIMESTAMPTZ;
  v_instances_created INTEGER := 0;
BEGIN
  -- Extract and validate recurring parameters
  v_is_recurring := COALESCE((p_event_data->>'is_recurring')::boolean, false);
  v_repeat_pattern := NULLIF(trim(p_event_data->>'repeat_pattern'), '');
  
  -- Parse repeat_until date safely
  BEGIN
    v_repeat_until := CASE 
      WHEN p_event_data->>'repeat_until' IS NOT NULL AND 
           trim(p_event_data->>'repeat_until') != '' AND
           trim(p_event_data->>'repeat_until') != 'null'
      THEN (trim(p_event_data->>'repeat_until'))::date 
      ELSE NULL 
    END;
  EXCEPTION WHEN OTHERS THEN
    v_repeat_until := NULL;
  END;
  
  -- Parse dates
  v_start_date := (p_event_data->>'start_date')::timestamptz;
  v_end_date := (p_event_data->>'end_date')::timestamptz;
  
  -- Parse reminder_time
  BEGIN
    v_reminder_time := CASE 
      WHEN p_event_data->>'reminder_time' IS NOT NULL AND 
           trim(p_event_data->>'reminder_time') != '' AND
           trim(p_event_data->>'reminder_time') != 'null'
      THEN (trim(p_event_data->>'reminder_time'))::timestamptz 
      ELSE NULL 
    END;
  EXCEPTION WHEN OTHERS THEN
    v_reminder_time := NULL;
  END;

  -- Enhanced debug logging for biweekly issue
  RAISE NOTICE '🔍 Event data received: is_recurring=%, repeat_pattern=%, repeat_until=%, start_date=%, reminder_time=%', 
               v_is_recurring, v_repeat_pattern, v_repeat_until, v_start_date::date, v_reminder_time;

  -- Validate recurring event parameters (keep existing validation)
  IF v_is_recurring = true THEN
    -- Reset recurring flags if validation fails
    IF v_repeat_pattern IS NULL OR 
       v_repeat_pattern NOT IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly') OR
       v_repeat_until IS NULL OR
       v_repeat_until <= v_start_date::date THEN
      
      RAISE NOTICE '❌ Invalid recurring parameters, creating single event instead. Pattern: %, Until: %, Start: %', 
                   v_repeat_pattern, v_repeat_until, v_start_date::date;
      
      v_is_recurring := false;
      v_repeat_pattern := NULL;
      v_repeat_until := NULL;
    ELSE
      RAISE NOTICE '✅ Recurring event validation passed. Pattern: %, Until: %', 
                   v_repeat_pattern, v_repeat_until;
    END IF;
  END IF;

  -- Ensure we have safe values for title and user_surname
  v_safe_title := COALESCE(
    NULLIF(trim(p_event_data->>'title'), ''), 
    NULLIF(trim(p_event_data->>'user_surname'), ''), 
    'Untitled Event'
  );
  
  v_safe_user_surname := COALESCE(
    NULLIF(trim(p_event_data->>'user_surname'), ''), 
    NULLIF(trim(p_event_data->>'title'), ''), 
    'Unknown'
  );

  -- Insert or update the main event
  IF p_event_id IS NULL THEN
    -- Create new event
    INSERT INTO events (
      title, user_surname, user_number, social_network_link, event_notes,
      event_name, start_date, end_date, payment_status, payment_amount,
      user_id, type, is_recurring, repeat_pattern, repeat_until, reminder_time, created_at, updated_at
    ) VALUES (
      v_safe_title,
      v_safe_user_surname,
      p_event_data->>'user_number',
      p_event_data->>'social_network_link',
      p_event_data->>'event_notes',
      p_event_data->>'event_name',
      v_start_date,
      v_end_date,
      p_event_data->>'payment_status',
      CASE WHEN p_event_data->>'payment_amount' = '' THEN NULL 
           ELSE (p_event_data->>'payment_amount')::numeric END,
      p_user_id,
      COALESCE(p_event_data->>'type', 'event'),
      v_is_recurring,
      v_repeat_pattern,
      v_repeat_until,
      v_reminder_time,
      NOW(),
      NOW()
    ) RETURNING id INTO v_event_id;
    
    RAISE NOTICE '📝 Created parent event: % with reminder_time: %', v_event_id, v_reminder_time;
    
    -- Generate recurring instances immediately if this is a valid recurring event (keep existing logic)
    IF v_is_recurring = true AND 
       v_repeat_pattern IS NOT NULL AND 
       v_repeat_pattern IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly') AND
       v_repeat_until IS NOT NULL THEN

      RAISE NOTICE '🔄 About to call generate_recurring_events with pattern: %', v_repeat_pattern;
      
      SELECT public.generate_recurring_events(
        v_event_id,
        v_start_date,
        v_end_date,
        v_repeat_pattern,
        v_repeat_until,
        p_user_id
      ) INTO v_instances_created;
      
      RAISE NOTICE '✅ Generated % recurring instances for event %', v_instances_created, v_event_id;
    ELSE
      RAISE NOTICE '⚠️ Skipping recurring generation. is_recurring: %, pattern: %, until: %',
                   v_is_recurring, v_repeat_pattern, v_repeat_until;
    END IF;
    
  ELSE
    -- Update existing event - the trigger will automatically set updated_at = NOW()
    UPDATE events SET
      title = v_safe_title,
      user_surname = v_safe_user_surname,
      user_number = p_event_data->>'user_number', 
      social_network_link = p_event_data->>'social_network_link',
      event_notes = p_event_data->>'event_notes',
      event_name = p_event_data->>'event_name',
      start_date = v_start_date,
      end_date = v_end_date,
      payment_status = p_event_data->>'payment_status',
      payment_amount = CASE WHEN p_event_data->>'payment_amount' = '' THEN NULL 
                           ELSE (p_event_data->>'payment_amount')::numeric END,
      is_recurring = v_is_recurring,
      repeat_pattern = v_repeat_pattern,
      repeat_until = v_repeat_until,
      reminder_time = v_reminder_time
    WHERE id = p_event_id AND user_id = p_user_id;
    
    v_event_id := p_event_id;
    
    -- Delete existing additional persons for this event
    DELETE FROM customers 
    WHERE event_id = v_event_id AND user_id = p_user_id;
  END IF;

  -- Insert additional persons (keep existing logic)
  FOR v_person IN SELECT * FROM jsonb_array_elements(p_additional_persons)
  LOOP
    INSERT INTO customers (
      title, user_surname, user_number, social_network_link, event_notes,
      payment_status, payment_amount, user_id, event_id, type,
      start_date, end_date
    ) VALUES (
      COALESCE(NULLIF(trim(v_person->>'userSurname'), ''), 'Unknown'),
      COALESCE(NULLIF(trim(v_person->>'userSurname'), ''), 'Unknown'),
      v_person->>'userNumber',
      v_person->>'socialNetworkLink', 
      v_person->>'eventNotes',
      v_person->>'paymentStatus',
      CASE WHEN v_person->>'paymentAmount' = '' THEN NULL 
           ELSE (v_person->>'paymentAmount')::numeric END,
      p_user_id,
      v_event_id,
      'customer',
      v_start_date,
      v_end_date
    );
  END LOOP;

  RETURN v_event_id;
END;
$function$;

-- Update get_public_calendar_events function to include reminder_time
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
   event_deleted_at timestamp with time zone,
   event_reminder_time timestamp with time zone
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

  -- Return ALL events from the events table
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
    e.deleted_at as event_deleted_at,
    e.reminder_time as event_reminder_time
  FROM events e
  WHERE e.user_id = business_user_id
    AND e.deleted_at IS NULL
  
  UNION ALL
  
  -- Return approved booking requests as events (no reminder_time for booking requests)
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
    br.deleted_at as event_deleted_at,
    NULL::timestamp with time zone as event_reminder_time
  FROM booking_requests br
  WHERE br.business_id = business_id_param
    AND br.status = 'approved'
    AND br.deleted_at IS NULL
  
  ORDER BY event_start_date ASC;
END;
$function$;
