
-- First, let's create the corrected generate_recurring_events function
CREATE OR REPLACE FUNCTION public.generate_recurring_events(
  p_parent_event_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_repeat_pattern TEXT,
  p_repeat_until DATE,
  p_user_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_start TIMESTAMPTZ := p_start_date;
  v_current_end TIMESTAMPTZ := p_end_date;
  v_next_start TIMESTAMPTZ;
  v_next_end TIMESTAMPTZ;
  v_counter INTEGER := 0;
  v_parent_event RECORD;
BEGIN
  -- Get parent event data
  SELECT * INTO v_parent_event FROM events WHERE id = p_parent_event_id;
  
  IF v_parent_event IS NULL THEN
    RAISE EXCEPTION 'Parent event not found: %', p_parent_event_id;
  END IF;
  
  RAISE NOTICE 'Starting recurring generation for parent %, pattern: %, until: %', 
    p_parent_event_id, p_repeat_pattern, p_repeat_until;
  
  LOOP
    -- Calculate next recurrence
    IF p_repeat_pattern = 'daily' THEN
      v_next_start := v_current_start + INTERVAL '1 day';
      v_next_end := v_current_end + INTERVAL '1 day';
    ELSIF p_repeat_pattern = 'weekly' THEN
      v_next_start := v_current_start + INTERVAL '1 week';
      v_next_end := v_current_end + INTERVAL '1 week';
    ELSIF p_repeat_pattern = 'monthly' THEN
      v_next_start := v_current_start + INTERVAL '1 month';
      v_next_end := v_current_end + INTERVAL '1 month';
    ELSIF p_repeat_pattern = 'yearly' THEN
      v_next_start := v_current_start + INTERVAL '1 year';
      v_next_end := v_current_end + INTERVAL '1 year';
    ELSE
      RAISE NOTICE 'Invalid repeat pattern: %', p_repeat_pattern;
      EXIT;
    END IF;

    -- Stop if the next recurrence is after repeat_until date
    IF v_next_start::date > p_repeat_until THEN
      RAISE NOTICE 'Stopping at date %', v_next_start::date;
      EXIT;
    END IF;

    -- Insert child event
    INSERT INTO events (
      title, user_surname, user_number, social_network_link, event_notes, event_name,
      start_date, end_date, payment_status, payment_amount,
      user_id, type, is_recurring, repeat_pattern, repeat_until, parent_event_id,
      language, created_at
    ) VALUES (
      v_parent_event.title,
      v_parent_event.user_surname,
      v_parent_event.user_number,
      v_parent_event.social_network_link,
      v_parent_event.event_notes,
      v_parent_event.event_name,
      v_next_start,
      v_next_end,
      v_parent_event.payment_status,
      v_parent_event.payment_amount,
      p_user_id,
      COALESCE(v_parent_event.type, 'event'),
      false, -- Child events are not recurring themselves
      NULL,
      NULL,
      p_parent_event_id,
      COALESCE(v_parent_event.language, 'en'),
      NOW()
    );

    v_current_start := v_next_start;
    v_current_end := v_next_end;
    v_counter := v_counter + 1;
    
    RAISE NOTICE 'Created child event #% for date %', v_counter, v_next_start::date;
    
    -- Safety limit to prevent infinite loops
    IF v_counter >= 100 THEN
      RAISE NOTICE 'Hit safety limit of 100 recurring events';
      EXIT;
    END IF;
  END LOOP;

  RAISE NOTICE 'Generated % recurring events for parent %', v_counter, p_parent_event_id;
  RETURN v_counter;
END;
$$;

-- Now update the save_event_with_persons function to properly call the generator
CREATE OR REPLACE FUNCTION public.save_event_with_persons(
  p_event_data jsonb, 
  p_additional_persons jsonb, 
  p_user_id uuid, 
  p_event_id uuid DEFAULT NULL::uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
  v_person JSONB;
  v_recurring_count INTEGER;
  v_safe_title TEXT;
  v_safe_user_surname TEXT;
  v_is_recurring BOOLEAN;
  v_repeat_pattern TEXT;
  v_repeat_until DATE;
BEGIN
  -- Extract recurring parameters with debugging
  v_is_recurring := COALESCE((p_event_data->>'is_recurring')::boolean, false);
  v_repeat_pattern := p_event_data->>'repeat_pattern';
  v_repeat_until := CASE WHEN p_event_data->>'repeat_until' IS NOT NULL AND p_event_data->>'repeat_until' != ''
                        THEN (p_event_data->>'repeat_until')::date 
                        ELSE NULL END;

  RAISE NOTICE 'Processing event with recurring params - is_recurring: %, pattern: %, until: %', 
    v_is_recurring, v_repeat_pattern, v_repeat_until;

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
      user_id, type, is_recurring, repeat_pattern, repeat_until, created_at
    ) VALUES (
      v_safe_title,
      v_safe_user_surname,
      p_event_data->>'user_number',
      p_event_data->>'social_network_link',
      p_event_data->>'event_notes',
      p_event_data->>'event_name',
      (p_event_data->>'start_date')::timestamptz,
      (p_event_data->>'end_date')::timestamptz,
      p_event_data->>'payment_status',
      CASE WHEN p_event_data->>'payment_amount' = '' THEN NULL 
           ELSE (p_event_data->>'payment_amount')::numeric END,
      p_user_id,
      COALESCE(p_event_data->>'type', 'event'),
      v_is_recurring,
      v_repeat_pattern,
      v_repeat_until,
      NOW()
    ) RETURNING id INTO v_event_id;
    
    RAISE NOTICE 'Created parent event % with title: %, recurring: %, pattern: %, until: %', 
      v_event_id, v_safe_title, v_is_recurring, v_repeat_pattern, v_repeat_until;
    
    -- CRITICAL: Generate recurring instances if this is a recurring event
    IF v_is_recurring = true AND 
       v_repeat_pattern IS NOT NULL AND 
       v_repeat_pattern != 'none' AND 
       v_repeat_pattern != '' AND
       v_repeat_until IS NOT NULL THEN
      
      RAISE NOTICE 'Calling generate_recurring_events for event % with pattern % until %', 
        v_event_id, v_repeat_pattern, v_repeat_until;
      
      BEGIN
        -- Call the corrected generate_recurring_events function
        SELECT generate_recurring_events(
          v_event_id,
          (p_event_data->>'start_date')::timestamptz,
          (p_event_data->>'end_date')::timestamptz,
          v_repeat_pattern,
          v_repeat_until,
          p_user_id
        ) INTO v_recurring_count;
        
        RAISE NOTICE 'Successfully generated % recurring instances for event %', v_recurring_count, v_event_id;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'ERROR generating recurring events for event %: % - %', v_event_id, SQLSTATE, SQLERRM;
          -- Don't fail the entire operation, just log the error
      END;
    ELSE
      RAISE NOTICE 'Skipping recurring generation - is_recurring: %, pattern: "%", until: %', 
        v_is_recurring, v_repeat_pattern, v_repeat_until;
    END IF;
    
  ELSE
    -- Update existing event
    UPDATE events SET
      title = v_safe_title,
      user_surname = v_safe_user_surname,
      user_number = p_event_data->>'user_number', 
      social_network_link = p_event_data->>'social_network_link',
      event_notes = p_event_data->>'event_notes',
      event_name = p_event_data->>'event_name',
      start_date = (p_event_data->>'start_date')::timestamptz,
      end_date = (p_event_data->>'end_date')::timestamptz,
      payment_status = p_event_data->>'payment_status',
      payment_amount = CASE WHEN p_event_data->>'payment_amount' = '' THEN NULL 
                           ELSE (p_event_data->>'payment_amount')::numeric END,
      is_recurring = v_is_recurring,
      repeat_pattern = v_repeat_pattern,
      repeat_until = v_repeat_until
    WHERE id = p_event_id AND user_id = p_user_id;
    
    v_event_id := p_event_id;
    RAISE NOTICE 'Updated existing event %', v_event_id;
    
    -- Delete existing additional persons for this event
    DELETE FROM customers 
    WHERE event_id = v_event_id AND user_id = p_user_id;
  END IF;

  -- Insert additional persons
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
      (p_event_data->>'start_date')::timestamptz,
      (p_event_data->>'end_date')::timestamptz
    );
  END LOOP;

  RAISE NOTICE 'Returning event_id: %', v_event_id;
  RETURN v_event_id;
END;
$$;
