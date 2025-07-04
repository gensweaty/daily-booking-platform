
-- Fix the save_event_with_persons function to properly handle recurring events
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
  v_safe_title TEXT;
  v_safe_user_surname TEXT;
  v_is_recurring BOOLEAN;
  v_repeat_pattern TEXT;
  v_repeat_until DATE;
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_child_count INTEGER;
BEGIN
  -- Extract and validate recurring parameters
  v_is_recurring := COALESCE((p_event_data->>'is_recurring')::boolean, false);
  v_repeat_pattern := NULLIF(trim(COALESCE(p_event_data->>'repeat_pattern', '')), '');
  v_repeat_until := CASE 
    WHEN p_event_data->>'repeat_until' IS NOT NULL AND trim(p_event_data->>'repeat_until') != ''
    THEN (p_event_data->>'repeat_until')::date 
    ELSE NULL 
  END;
  v_start_date := (p_event_data->>'start_date')::timestamptz;
  v_end_date := (p_event_data->>'end_date')::timestamptz;

  -- Debug logging
  RAISE NOTICE 'Processing event - is_recurring: %, pattern: %, until: %, start: %', 
    v_is_recurring, v_repeat_pattern, v_repeat_until, v_start_date;

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
      NOW()
    ) RETURNING id INTO v_event_id;
    
    RAISE NOTICE 'Created parent event with ID: %', v_event_id;
    
    -- CRITICAL: Generate recurring instances with strict validation
    IF v_is_recurring = true AND 
       v_repeat_pattern IS NOT NULL AND 
       v_repeat_pattern != 'none' AND 
       v_repeat_pattern != '' AND
       v_repeat_until IS NOT NULL AND
       v_repeat_until > v_start_date::date THEN

      RAISE NOTICE 'Generating recurring events - pattern: %, until: %', v_repeat_pattern, v_repeat_until;
      
      SELECT public.generate_recurring_events(
        v_event_id,
        v_start_date,
        v_end_date,
        v_repeat_pattern,
        v_repeat_until,
        p_user_id
      ) INTO v_child_count;
      
      RAISE NOTICE 'Generated % child events for parent %', v_child_count, v_event_id;
    ELSE
      RAISE NOTICE 'Skipping recurring generation - is_recurring: %, pattern: %, until: %, valid_until: %', 
        v_is_recurring, v_repeat_pattern, v_repeat_until, (v_repeat_until > v_start_date::date);
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
      start_date = v_start_date,
      end_date = v_end_date,
      payment_status = p_event_data->>'payment_status',
      payment_amount = CASE WHEN p_event_data->>'payment_amount' = '' THEN NULL 
                           ELSE (p_event_data->>'payment_amount')::numeric END,
      is_recurring = v_is_recurring,
      repeat_pattern = v_repeat_pattern,
      repeat_until = v_repeat_until
    WHERE id = p_event_id AND user_id = p_user_id;
    
    v_event_id := p_event_id;
    
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
      v_start_date,
      v_end_date
    );
  END LOOP;

  RETURN v_event_id;
END;
$$;

-- Also fix the generate_recurring_events function to be more robust
CREATE OR REPLACE FUNCTION public.generate_recurring_events(
  p_parent_event_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_repeat_pattern TEXT,
  p_repeat_until DATE,
  p_user_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_start TIMESTAMPTZ := p_start_date;
  v_current_end TIMESTAMPTZ := p_end_date;
  v_counter INTEGER := 0;
  v_max_iterations INTEGER := 100; -- Safety limit
BEGIN
  RAISE NOTICE 'Starting recurring generation for parent %, pattern: %, until: %', 
    p_parent_event_id, p_repeat_pattern, p_repeat_until;
    
  LOOP
    -- Safety check to prevent infinite loops
    IF v_counter >= v_max_iterations THEN
      RAISE NOTICE 'Reached maximum iterations limit (%) for recurring events', v_max_iterations;
      EXIT;
    END IF;
    
    -- Calculate next occurrence
    IF p_repeat_pattern = 'daily' THEN
      v_current_start := v_current_start + INTERVAL '1 day';
      v_current_end := v_current_end + INTERVAL '1 day';
    ELSIF p_repeat_pattern = 'weekly' THEN
      v_current_start := v_current_start + INTERVAL '1 week';
      v_current_end := v_current_end + INTERVAL '1 week';
    ELSIF p_repeat_pattern = 'monthly' THEN
      v_current_start := v_current_start + INTERVAL '1 month';
      v_current_end := v_current_end + INTERVAL '1 month';
    ELSE
      RAISE NOTICE 'Unknown repeat pattern: %', p_repeat_pattern;
      EXIT;
    END IF;

    -- Only create if next start is within repeat_until (inclusive)
    IF v_current_start::date > p_repeat_until THEN
      RAISE NOTICE 'Next occurrence (%) is past repeat_until (%), stopping', 
        v_current_start::date, p_repeat_until;
      EXIT;
    END IF;

    RAISE NOTICE 'Creating child event % for date %', v_counter + 1, v_current_start;

    INSERT INTO events (
      title, user_surname, user_number, social_network_link, event_notes, event_name,
      start_date, end_date, payment_status, payment_amount,
      user_id, type, is_recurring, repeat_pattern, repeat_until, parent_event_id
    )
    SELECT
      title, user_surname, user_number, social_network_link, event_notes, event_name,
      v_current_start, v_current_end, payment_status, payment_amount,
      user_id, type, is_recurring, repeat_pattern, repeat_until, id
    FROM events WHERE id = p_parent_event_id;

    v_counter := v_counter + 1;
  END LOOP;

  RAISE NOTICE 'Generated % recurring events for parent %', v_counter, p_parent_event_id;
  RETURN v_counter;
END;
$$;
