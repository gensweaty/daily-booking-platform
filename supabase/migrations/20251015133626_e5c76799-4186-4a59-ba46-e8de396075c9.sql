-- Fix save_event_with_persons to accept ALL 10 parameters including AI boolean flags
-- This is what the AI chat edge function is actually calling with

DROP FUNCTION IF EXISTS public.save_event_with_persons CASCADE;

CREATE OR REPLACE FUNCTION public.save_event_with_persons(
  p_event_data jsonb, 
  p_additional_persons jsonb, 
  p_user_id uuid, 
  p_event_id uuid DEFAULT NULL::uuid, 
  p_created_by_type text DEFAULT 'admin'::text, 
  p_created_by_name text DEFAULT NULL::text, 
  p_created_by_ai boolean DEFAULT false,
  p_last_edited_by_type text DEFAULT NULL::text, 
  p_last_edited_by_name text DEFAULT NULL::text,
  p_last_edited_by_ai boolean DEFAULT false
)
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
  v_reminder_at TIMESTAMPTZ;
  v_email_reminder_enabled BOOLEAN;
  v_instances_created INTEGER := 0;
  v_recurring_event_ids UUID[];
  v_target_event_id UUID;
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
  
  -- Parse dates and reminder fields
  v_start_date := (p_event_data->>'start_date')::timestamptz;
  v_end_date := (p_event_data->>'end_date')::timestamptz;
  
  -- Parse reminder fields safely
  BEGIN
    v_reminder_at := CASE 
      WHEN p_event_data->>'reminder_at' IS NOT NULL AND 
           trim(p_event_data->>'reminder_at') != '' AND
           trim(p_event_data->>'reminder_at') != 'null'
      THEN (p_event_data->>'reminder_at')::timestamptz
      ELSE NULL
    END;
  EXCEPTION WHEN OTHERS THEN
    v_reminder_at := NULL;
  END;
  
  v_email_reminder_enabled := COALESCE((p_event_data->>'email_reminder_enabled')::boolean, false);

  -- Enhanced debug logging
  RAISE NOTICE '🔍 Event data received: is_recurring=%, repeat_pattern=%, repeat_until=%, start_date=%, reminder_at=%, email_reminder=%, created_by=% (%), AI=%', 
               v_is_recurring, v_repeat_pattern, v_repeat_until, v_start_date::date, v_reminder_at, v_email_reminder_enabled, p_created_by_name, p_created_by_type, p_created_by_ai;

  -- Validate recurring event parameters
  IF v_is_recurring = true THEN
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
    -- Create new event with proper metadata including AI flags
    INSERT INTO events (
      title, user_surname, user_number, social_network_link, event_notes,
      event_name, start_date, end_date, payment_status, payment_amount,
      user_id, type, is_recurring, repeat_pattern, repeat_until, 
      reminder_at, email_reminder_enabled,
      created_by_type, created_by_name, created_by_ai,
      last_edited_by_type, last_edited_by_name, last_edited_by_ai,
      created_at, updated_at
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
      v_reminder_at,
      v_email_reminder_enabled,
      p_created_by_type,
      p_created_by_name,
      p_created_by_ai,
      p_last_edited_by_type,
      p_last_edited_by_name,
      p_last_edited_by_ai,
      NOW(),
      NOW()
    ) RETURNING id INTO v_event_id;
    
    RAISE NOTICE '📝 Created parent event: % with recurring: %, pattern: %, until: %, reminder: %, email_reminder: %, created_by: % (%), AI: %', 
                 v_event_id, v_is_recurring, v_repeat_pattern, v_repeat_until, v_reminder_at, v_email_reminder_enabled, p_created_by_name, p_created_by_type, p_created_by_ai;
    
    -- Generate recurring instances if needed
    IF v_is_recurring = true AND 
       v_repeat_pattern IS NOT NULL AND 
       v_repeat_pattern IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly') AND
       v_repeat_until IS NOT NULL THEN

      SELECT public.generate_recurring_events(
        v_event_id,
        v_start_date,
        v_end_date,
        v_repeat_pattern,
        v_repeat_until,
        p_user_id
      ) INTO v_instances_created;
      
      RAISE NOTICE '✅ Generated % recurring instances for event %', v_instances_created, v_event_id;
    END IF;
    
    v_target_event_id := v_event_id;
    
  ELSE
    -- Update existing event with proper metadata including AI flags
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
      reminder_at = v_reminder_at,
      email_reminder_enabled = v_email_reminder_enabled,
      last_edited_by_type = p_last_edited_by_type,
      last_edited_by_name = p_last_edited_by_name,
      last_edited_by_ai = p_last_edited_by_ai,
      updated_at = NOW()
    WHERE id = p_event_id AND user_id = p_user_id;
    
    v_event_id := p_event_id;
    v_target_event_id := p_event_id;
    
    RAISE NOTICE '📝 Updated event: % with reminder: %, email_reminder: %, edited_by: % (%), AI: %', 
                 v_event_id, v_reminder_at, v_email_reminder_enabled, p_last_edited_by_name, p_last_edited_by_type, p_last_edited_by_ai;
  END IF;

  -- Handle customer updates for recurring events
  SELECT ARRAY[v_target_event_id] INTO v_recurring_event_ids;
  
  -- If updating a recurring event, find ALL related events in the series
  IF p_event_id IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN is_recurring = true THEN ARRAY[id]
        WHEN parent_event_id IS NOT NULL THEN ARRAY[parent_event_id]
        ELSE ARRAY[id]
      END
    INTO v_recurring_event_ids
    FROM events 
    WHERE id = p_event_id AND user_id = p_user_id;
    
    IF array_length(v_recurring_event_ids, 1) > 0 THEN
      SELECT ARRAY_AGG(DISTINCT id) INTO v_recurring_event_ids
      FROM events 
      WHERE user_id = p_user_id 
        AND (id = ANY(v_recurring_event_ids) OR parent_event_id = ANY(v_recurring_event_ids))
        AND deleted_at IS NULL;
    END IF;
    
    RAISE NOTICE '🔄 Recurring series update - will update customers for events: %', v_recurring_event_ids;
  END IF;

  -- Delete existing additional persons for ALL events in the recurring series
  IF array_length(v_recurring_event_ids, 1) > 0 THEN
    DELETE FROM customers 
    WHERE event_id = ANY(v_recurring_event_ids) AND user_id = p_user_id;
    
    RAISE NOTICE '🗑️ Deleted existing customers for % events in series', array_length(v_recurring_event_ids, 1);
  END IF;

  -- Insert additional persons for ALL events in the recurring series
  FOR v_person IN SELECT * FROM jsonb_array_elements(p_additional_persons)
  LOOP
    IF array_length(v_recurring_event_ids, 1) > 0 THEN
      INSERT INTO customers (
        title, user_surname, user_number, social_network_link, event_notes,
        payment_status, payment_amount, user_id, event_id, type,
        start_date, end_date,
        created_by_type, created_by_name, created_by_ai,
        last_edited_by_type, last_edited_by_name, last_edited_by_ai
      )
      SELECT 
        COALESCE(NULLIF(trim(v_person->>'userSurname'), ''), 'Unknown'),
        COALESCE(NULLIF(trim(v_person->>'userSurname'), ''), 'Unknown'),
        v_person->>'userNumber',
        v_person->>'socialNetworkLink', 
        v_person->>'eventNotes',
        v_person->>'paymentStatus',
        CASE WHEN v_person->>'paymentAmount' = '' THEN NULL 
             ELSE (v_person->>'paymentAmount')::numeric END,
        p_user_id,
        event_id,
        'customer',
        v_start_date,
        v_end_date,
        p_created_by_type,
        p_created_by_name,
        p_created_by_ai,
        p_last_edited_by_type,
        p_last_edited_by_name,
        p_last_edited_by_ai
      FROM unnest(v_recurring_event_ids) AS event_id;
      
      RAISE NOTICE '👤 Created customer "%" for % events in recurring series', 
                   COALESCE(NULLIF(trim(v_person->>'userSurname'), ''), 'Unknown'), 
                   array_length(v_recurring_event_ids, 1);
    END IF;
  END LOOP;

  RETURN v_event_id;
END;
$function$;