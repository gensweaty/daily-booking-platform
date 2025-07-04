
-- Enhanced save_event_with_persons function with comprehensive validation and fallbacks
CREATE OR REPLACE FUNCTION public.save_event_with_persons(
  p_event_data JSONB,
  p_additional_persons JSONB,
  p_user_id UUID,
  p_event_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_person JSONB;
  v_recurring_count INTEGER;
  v_safe_title TEXT;
  v_safe_user_surname TEXT;
  v_is_recurring BOOLEAN;
  v_repeat_pattern TEXT;
  v_repeat_until DATE;
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
BEGIN
  -- CRITICAL: Comprehensive validation of input data
  RAISE NOTICE 'DEBUG: Raw input data: %', p_event_data;
  
  -- Extract and validate start_date with multiple fallback strategies
  BEGIN
    v_start_date := (p_event_data->>'start_date')::TIMESTAMPTZ;
    IF v_start_date IS NULL THEN
      RAISE EXCEPTION 'start_date is null after parsing: %', p_event_data->>'start_date';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to parse start_date: %. Error: %', p_event_data->>'start_date', SQLERRM;
  END;
  
  -- Extract and validate end_date with multiple fallback strategies
  BEGIN
    v_end_date := (p_event_data->>'end_date')::TIMESTAMPTZ;
    IF v_end_date IS NULL THEN
      RAISE EXCEPTION 'end_date is null after parsing: %', p_event_data->>'end_date';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to parse end_date: %. Error: %', p_event_data->>'end_date', SQLERRM;
  END;
  
  -- Validate dates are logical
  IF v_end_date <= v_start_date THEN
    RAISE EXCEPTION 'end_date must be after start_date. Start: %, End: %', v_start_date, v_end_date;
  END IF;
  
  -- Extract recurring parameters with debugging
  v_is_recurring := COALESCE((p_event_data->>'is_recurring')::boolean, false);
  v_repeat_pattern := p_event_data->>'repeat_pattern';
  v_repeat_until := CASE WHEN p_event_data->>'repeat_until' IS NOT NULL AND p_event_data->>'repeat_until' != ''
                        THEN (p_event_data->>'repeat_until')::date 
                        ELSE NULL END;

  RAISE NOTICE 'DEBUG: Processing event with recurring params - is_recurring: %, pattern: %, until: %', 
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
    -- Create new event with validated data
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
      v_start_date,  -- Use validated date
      v_end_date,    -- Use validated date
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
    
    -- CRUCIAL FIX: Generate recurring instances if this is a recurring event
    IF v_is_recurring = true AND 
       v_repeat_pattern IS NOT NULL AND 
       v_repeat_pattern != 'none' AND 
       v_repeat_pattern != '' THEN
      
      RAISE NOTICE 'Attempting to generate recurring instances for event % with pattern % until %', 
        v_event_id, v_repeat_pattern, v_repeat_until;
      
      BEGIN
        -- Call generate_recurring_events with validated dates
        PERFORM generate_recurring_events(
          v_event_id,
          v_start_date,  -- Use validated date
          v_end_date,    -- Use validated date
          v_repeat_pattern,
          v_repeat_until,
          p_user_id
        );
        
        -- Check how many child events were actually created
        SELECT COUNT(*) INTO v_recurring_count
        FROM events 
        WHERE parent_event_id = v_event_id;
        
        RAISE NOTICE 'Successfully generated % recurring instances for event %', v_recurring_count, v_event_id;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'ERROR generating recurring events for event %: % - %', v_event_id, SQLSTATE, SQLERRM;
          -- Don't fail the entire operation, just log the error
      END;
    ELSE
      RAISE NOTICE 'Skipping recurring generation - is_recurring: %, pattern: "%"', v_is_recurring, v_repeat_pattern;
    END IF;
    
  ELSE
    -- Update existing event with validated data
    UPDATE events SET
      title = v_safe_title,
      user_surname = v_safe_user_surname,
      user_number = p_event_data->>'user_number', 
      social_network_link = p_event_data->>'social_network_link',
      event_notes = p_event_data->>'event_notes',
      event_name = p_event_data->>'event_name',
      start_date = v_start_date,  -- Use validated date
      end_date = v_end_date,      -- Use validated date
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

  -- Insert additional persons with validated dates
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
      v_start_date,  -- Use validated date
      v_end_date     -- Use validated date
    );
  END LOOP;

  RAISE NOTICE 'Returning event_id: %', v_event_id;
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
