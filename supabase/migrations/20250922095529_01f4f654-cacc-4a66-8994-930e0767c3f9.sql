-- Phase 1: Add exclusion mechanism for recurring events
-- Add excluded_from_series field to events table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'excluded_from_series'
  ) THEN
    ALTER TABLE events ADD COLUMN excluded_from_series BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN events.excluded_from_series IS 'Marks event instance as excluded from recurring series';
  END IF;
END $$;

-- Phase 2: Create safe series update function that preserves individual event dates
CREATE OR REPLACE FUNCTION public.update_event_series_safe(
  p_event_id uuid, 
  p_user_id uuid, 
  p_event_data jsonb, 
  p_additional_persons jsonb, 
  p_edited_by_type text DEFAULT 'admin'::text, 
  p_edited_by_name text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_parent_event_id uuid;
  v_is_recurring boolean;
  v_series_event_ids uuid[];
  v_updated_count integer := 0;
  v_result jsonb;
  v_event_record events%ROWTYPE;
BEGIN
  -- Get the event record to determine if it's part of a series
  SELECT * INTO v_event_record
  FROM events 
  WHERE id = p_event_id AND user_id = p_user_id;
  
  IF v_event_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;
  
  v_is_recurring := v_event_record.is_recurring;
  v_parent_event_id := v_event_record.parent_event_id;
  
  -- Determine the parent event ID for the series
  IF v_is_recurring = true AND v_parent_event_id IS NULL THEN
    -- This is the parent event
    v_parent_event_id := p_event_id;
  ELSIF v_parent_event_id IS NOT NULL THEN
    -- This is a child event, use its parent
    v_parent_event_id := v_parent_event_id;
  ELSE
    -- Single event, no series to update
    RETURN jsonb_build_object('success', false, 'error', 'Not a recurring event series');
  END IF;
  
  -- Get all events in the series (parent + children), excluding those excluded from series
  SELECT ARRAY_AGG(id) INTO v_series_event_ids
  FROM events 
  WHERE user_id = p_user_id 
    AND (id = v_parent_event_id OR parent_event_id = v_parent_event_id)
    AND deleted_at IS NULL
    AND excluded_from_series = FALSE;
  
  RAISE NOTICE '🔄 Updating event series safely: parent_id=%, series_count=%', 
               v_parent_event_id, array_length(v_series_event_ids, 1);
  
  -- Update all events in the series with NON-TEMPORAL fields only
  -- CRITICAL: Do NOT update start_date or end_date to preserve individual event times
  UPDATE events SET
    title = COALESCE(p_event_data->>'title', title),
    user_surname = COALESCE(p_event_data->>'user_surname', user_surname),
    user_number = COALESCE(p_event_data->>'user_number', user_number),
    social_network_link = COALESCE(p_event_data->>'social_network_link', social_network_link),
    event_notes = COALESCE(p_event_data->>'event_notes', event_notes),
    event_name = COALESCE(p_event_data->>'event_name', event_name),
    payment_status = COALESCE(p_event_data->>'payment_status', payment_status),
    payment_amount = CASE 
      WHEN p_event_data->>'payment_amount' IS NOT NULL AND p_event_data->>'payment_amount' != '' 
      THEN (p_event_data->>'payment_amount')::numeric 
      ELSE payment_amount 
    END,
    reminder_at = CASE 
      WHEN p_event_data->>'reminder_at' IS NOT NULL AND p_event_data->>'reminder_at' != '' 
      THEN (p_event_data->>'reminder_at')::timestamptz 
      ELSE reminder_at 
    END,
    email_reminder_enabled = COALESCE((p_event_data->>'email_reminder_enabled')::boolean, email_reminder_enabled),
    last_edited_by_type = p_edited_by_type,
    last_edited_by_name = p_edited_by_name,
    updated_at = NOW()
  WHERE id = ANY(v_series_event_ids);
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Update customers for all events in the series
  -- First delete existing customers for all events in the series
  DELETE FROM customers 
  WHERE event_id = ANY(v_series_event_ids) 
    AND user_id = p_user_id 
    AND type = 'customer';
  
  -- Then insert new customers for all events in the series
  IF jsonb_array_length(p_additional_persons) > 0 THEN
    -- Insert customer records for each person and each event in the series
    INSERT INTO customers (
      title, user_surname, user_number, social_network_link, event_notes,
      payment_status, payment_amount, user_id, event_id, type,
      start_date, end_date,
      created_by_type, created_by_name, last_edited_by_type, last_edited_by_name
    )
    SELECT 
      COALESCE(NULLIF(trim(person->>'userSurname'), ''), 'Unknown'),
      COALESCE(NULLIF(trim(person->>'userSurname'), ''), 'Unknown'),
      person->>'userNumber',
      person->>'socialNetworkLink', 
      person->>'eventNotes',
      person->>'paymentStatus',
      CASE WHEN person->>'paymentAmount' = '' THEN NULL 
           ELSE (person->>'paymentAmount')::numeric END,
      p_user_id,
      event_id,
      'customer',
      e.start_date,
      e.end_date,
      p_edited_by_type,
      p_edited_by_name,
      p_edited_by_type,
      p_edited_by_name
    FROM jsonb_array_elements(p_additional_persons) AS person
    CROSS JOIN unnest(v_series_event_ids) AS event_id
    JOIN events e ON e.id = event_id;
  END IF;
  
  RAISE NOTICE '✅ Safe series update complete: updated % events, parent_id=%', 
               v_updated_count, v_parent_event_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'updated_count', v_updated_count,
    'parent_event_id', v_parent_event_id,
    'series_event_ids', to_jsonb(v_series_event_ids)
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error updating event series safely: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Phase 3: Create function for "Edit Only This Event" - exclude from series and create new standalone event
CREATE OR REPLACE FUNCTION public.edit_single_event_instance(
  p_event_id uuid,
  p_user_id uuid, 
  p_event_data jsonb,
  p_additional_persons jsonb,
  p_edited_by_type text DEFAULT 'admin'::text,
  p_edited_by_name text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_original_event events%ROWTYPE;
  v_new_event_id uuid;
  v_parent_event_id uuid;
  v_instance_date date;
  v_result jsonb;
BEGIN
  -- Get the original event details
  SELECT * INTO v_original_event
  FROM events 
  WHERE id = p_event_id AND user_id = p_user_id;
  
  IF v_original_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Determine parent event ID
  IF v_original_event.parent_event_id IS NOT NULL THEN
    v_parent_event_id := v_original_event.parent_event_id;
  ELSIF v_original_event.is_recurring THEN
    v_parent_event_id := p_event_id;
  ELSE
    -- This is already a standalone event, just update it normally
    RETURN jsonb_build_object('success', false, 'error', 'Event is not part of a recurring series');
  END IF;

  -- Extract instance date from the event
  v_instance_date := v_original_event.start_date::date;
  
  RAISE NOTICE '🔄 Creating standalone event from instance: original_id=%, parent_id=%, date=%', 
               p_event_id, v_parent_event_id, v_instance_date;

  -- Step 1: Mark the original event as excluded from series (soft exclusion)
  UPDATE events 
  SET excluded_from_series = TRUE,
      last_edited_by_type = p_edited_by_type,
      last_edited_by_name = p_edited_by_name,
      updated_at = NOW()
  WHERE id = p_event_id;

  -- Step 2: Create new standalone event with the edited data
  INSERT INTO events (
    title, user_surname, user_number, social_network_link, event_notes,
    event_name, start_date, end_date, payment_status, payment_amount,
    user_id, type, is_recurring, parent_event_id,
    reminder_at, email_reminder_enabled, language,
    created_by_type, created_by_name, last_edited_by_type, last_edited_by_name,
    created_at, updated_at
  ) VALUES (
    COALESCE(p_event_data->>'title', v_original_event.title),
    COALESCE(p_event_data->>'user_surname', v_original_event.user_surname),
    COALESCE(p_event_data->>'user_number', v_original_event.user_number),
    COALESCE(p_event_data->>'social_network_link', v_original_event.social_network_link),
    COALESCE(p_event_data->>'event_notes', v_original_event.event_notes),
    COALESCE(p_event_data->>'event_name', v_original_event.event_name),
    CASE 
      WHEN p_event_data->>'start_date' IS NOT NULL 
      THEN (p_event_data->>'start_date')::timestamptz 
      ELSE v_original_event.start_date 
    END,
    CASE 
      WHEN p_event_data->>'end_date' IS NOT NULL 
      THEN (p_event_data->>'end_date')::timestamptz 
      ELSE v_original_event.end_date 
    END,
    COALESCE(p_event_data->>'payment_status', v_original_event.payment_status),
    CASE 
      WHEN p_event_data->>'payment_amount' IS NOT NULL AND p_event_data->>'payment_amount' != '' 
      THEN (p_event_data->>'payment_amount')::numeric 
      ELSE v_original_event.payment_amount 
    END,
    p_user_id,
    COALESCE(p_event_data->>'type', v_original_event.type, 'event'),
    FALSE, -- New standalone event is not recurring
    NULL,  -- No parent event ID for standalone event
    CASE 
      WHEN p_event_data->>'reminder_at' IS NOT NULL AND p_event_data->>'reminder_at' != '' 
      THEN (p_event_data->>'reminder_at')::timestamptz 
      ELSE v_original_event.reminder_at 
    END,
    COALESCE((p_event_data->>'email_reminder_enabled')::boolean, v_original_event.email_reminder_enabled),
    COALESCE(p_event_data->>'language', v_original_event.language, 'en'),
    p_edited_by_type,
    p_edited_by_name,
    p_edited_by_type,
    p_edited_by_name,
    NOW(),
    NOW()
  ) RETURNING id INTO v_new_event_id;

  -- Step 3: Add additional persons to the new standalone event
  IF jsonb_array_length(p_additional_persons) > 0 THEN
    INSERT INTO customers (
      title, user_surname, user_number, social_network_link, event_notes,
      payment_status, payment_amount, user_id, event_id, type,
      start_date, end_date,
      created_by_type, created_by_name, last_edited_by_type, last_edited_by_name
    )
    SELECT 
      COALESCE(NULLIF(trim(person->>'userSurname'), ''), 'Unknown'),
      COALESCE(NULLIF(trim(person->>'userSurname'), ''), 'Unknown'),
      person->>'userNumber',
      person->>'socialNetworkLink', 
      person->>'eventNotes',
      person->>'paymentStatus',
      CASE WHEN person->>'paymentAmount' = '' THEN NULL 
           ELSE (person->>'paymentAmount')::numeric END,
      p_user_id,
      v_new_event_id,
      'customer',
      CASE 
        WHEN p_event_data->>'start_date' IS NOT NULL 
        THEN (p_event_data->>'start_date')::timestamptz 
        ELSE v_original_event.start_date 
      END,
      CASE 
        WHEN p_event_data->>'end_date' IS NOT NULL 
        THEN (p_event_data->>'end_date')::timestamptz 
        ELSE v_original_event.end_date 
      END,
      p_edited_by_type,
      p_edited_by_name,
      p_edited_by_type,
      p_edited_by_name
    FROM jsonb_array_elements(p_additional_persons) AS person;
  END IF;

  RAISE NOTICE '✅ Single instance edit complete: excluded_id=%, new_standalone_id=%', 
               p_event_id, v_new_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'excluded_event_id', p_event_id, 
    'new_event_id', v_new_event_id,
    'parent_event_id', v_parent_event_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error creating standalone event instance: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Phase 4: Update recurring event generation to skip excluded dates
CREATE OR REPLACE FUNCTION public.generate_recurring_events(
  p_parent_event_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_repeat_pattern text,
  p_repeat_until date,
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_current_start timestamptz;
  v_current_end timestamptz;
  v_duration interval;
  v_instances_created integer := 0;
  v_max_instances integer := 365; -- Prevent runaway generation
  v_excluded_dates date[]; -- Track excluded dates
BEGIN
  -- Calculate event duration
  v_duration := p_end_date - p_start_date;
  
  -- Get any excluded dates for this series
  SELECT ARRAY_AGG(start_date::date) INTO v_excluded_dates
  FROM events 
  WHERE (id = p_parent_event_id OR parent_event_id = p_parent_event_id)
    AND excluded_from_series = TRUE
    AND user_id = p_user_id;
  
  -- Initialize first occurrence after the parent event
  v_current_start := p_start_date;
  v_current_end := p_end_date;
  
  -- Generate recurring instances
  WHILE v_current_start::date <= p_repeat_until AND v_instances_created < v_max_instances LOOP
    -- Move to next occurrence based on pattern
    CASE p_repeat_pattern
      WHEN 'daily' THEN
        v_current_start := v_current_start + INTERVAL '1 day';
      WHEN 'weekly' THEN
        v_current_start := v_current_start + INTERVAL '1 week';
      WHEN 'biweekly' THEN
        v_current_start := v_current_start + INTERVAL '2 weeks';
      WHEN 'monthly' THEN
        v_current_start := v_current_start + INTERVAL '1 month';
      WHEN 'yearly' THEN
        v_current_start := v_current_start + INTERVAL '1 year';
      ELSE
        EXIT; -- Unknown pattern, stop generation
    END CASE;
    
    v_current_end := v_current_start + v_duration;
    
    -- Skip if this date is excluded or if we've exceeded the end date
    IF v_current_start::date > p_repeat_until OR 
       (v_excluded_dates IS NOT NULL AND v_current_start::date = ANY(v_excluded_dates)) THEN
      CONTINUE;
    END IF;
    
    -- Create the recurring instance
    INSERT INTO events (
      title, user_surname, user_number, social_network_link, event_notes,
      event_name, start_date, end_date, payment_status, payment_amount,
      user_id, type, is_recurring, parent_event_id,
      reminder_at, email_reminder_enabled, language,
      created_by_type, created_by_name, last_edited_by_type, last_edited_by_name,
      created_at, updated_at
    )
    SELECT 
      title, user_surname, user_number, social_network_link, event_notes,
      event_name, v_current_start, v_current_end, payment_status, payment_amount,
      user_id, type, FALSE, p_parent_event_id,
      CASE 
        WHEN reminder_at IS NOT NULL 
        THEN reminder_at + (v_current_start - p_start_date)
        ELSE NULL 
      END,
      email_reminder_enabled, language,
      created_by_type, created_by_name, last_edited_by_type, last_edited_by_name,
      NOW(), NOW()
    FROM events 
    WHERE id = p_parent_event_id;
    
    v_instances_created := v_instances_created + 1;
  END LOOP;
  
  RAISE NOTICE '📅 Generated % recurring instances (excluded % dates)', v_instances_created, COALESCE(array_length(v_excluded_dates, 1), 0);
  
  RETURN v_instances_created;
END;
$function$;