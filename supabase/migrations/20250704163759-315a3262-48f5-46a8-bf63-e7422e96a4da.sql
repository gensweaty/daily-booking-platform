
-- Add default values to events table for created_at and updated_at columns
ALTER TABLE events ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE events ALTER COLUMN updated_at SET DEFAULT now();

-- Also update the save_event_with_persons function to explicitly handle created_at
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
BEGIN
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
    -- Create new event with safe values and explicit created_at
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
      COALESCE((p_event_data->>'created_at')::timestamptz, now())
    ) RETURNING id INTO v_event_id;
    
    RAISE NOTICE 'Created parent event % with title: %, recurring: %, pattern: %, until: %', 
      v_event_id, v_safe_title, v_is_recurring, v_repeat_pattern, v_repeat_until;
    
    -- CRUCIAL FIX: Generate recurring instances if this is a recurring event
    -- Updated condition to be more explicit and handle edge cases
    IF v_is_recurring = true AND 
       v_repeat_pattern IS NOT NULL AND 
       v_repeat_pattern != 'none' AND 
       v_repeat_pattern != '' THEN
      
      RAISE NOTICE 'Attempting to generate recurring instances for event % with pattern % until %', 
        v_event_id, v_repeat_pattern, v_repeat_until;
      
      BEGIN
        -- Call generate_recurring_events with proper error handling
        PERFORM generate_recurring_events(
          v_event_id,
          (p_event_data->>'start_date')::timestamptz,
          (p_event_data->>'end_date')::timestamptz,
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
    -- Update existing event with safe values
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
      repeat_until = v_repeat_until,
      updated_at = now()
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the generate_recurring_events function to explicitly handle created_at
CREATE OR REPLACE FUNCTION public.generate_recurring_events(
  p_parent_event_id uuid, 
  p_start_date timestamp with time zone, 
  p_end_date timestamp with time zone, 
  p_repeat_pattern text, 
  p_repeat_until date, 
  p_user_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_date TIMESTAMPTZ;
  v_end_limit TIMESTAMPTZ;
  v_event_duration INTERVAL;
  v_count INTEGER := 0;
  v_parent_event RECORD;
  v_safe_title TEXT;
  v_safe_user_surname TEXT;
BEGIN
  -- Get parent event data
  SELECT * INTO v_parent_event FROM events WHERE id = p_parent_event_id;
  
  IF v_parent_event IS NULL THEN
    RAISE EXCEPTION 'Parent event not found: %', p_parent_event_id;
  END IF;
  
  -- Ensure we have safe values for title and user_surname with proper fallbacks
  v_safe_title := COALESCE(
    NULLIF(trim(v_parent_event.title), ''), 
    NULLIF(trim(v_parent_event.user_surname), ''), 
    'Untitled Event'
  );
  
  v_safe_user_surname := COALESCE(
    NULLIF(trim(v_parent_event.user_surname), ''), 
    NULLIF(trim(v_parent_event.title), ''), 
    'Unknown'
  );
  
  RAISE NOTICE 'Generating recurring events for parent %, title: %, pattern: %', 
    p_parent_event_id, v_safe_title, p_repeat_pattern;
  
  -- Calculate event duration
  v_event_duration := p_end_date - p_start_date;
  
  -- Set end limit (repeat_until or 2 years from now, whichever is earlier)
  v_end_limit := LEAST(
    COALESCE(p_repeat_until::TIMESTAMPTZ, p_start_date + INTERVAL '2 years'),
    p_start_date + INTERVAL '2 years'
  );
  
  -- Initialize current date based on pattern
  CASE p_repeat_pattern
    WHEN 'daily' THEN v_current_date := p_start_date + INTERVAL '1 day';
    WHEN 'weekly' THEN v_current_date := p_start_date + INTERVAL '1 week';
    WHEN 'monthly' THEN v_current_date := p_start_date + INTERVAL '1 month';
    WHEN 'yearly' THEN v_current_date := p_start_date + INTERVAL '1 year';
    ELSE 
      RAISE EXCEPTION 'Invalid repeat pattern: %', p_repeat_pattern;
  END CASE;
  
  -- Generate recurring instances
  WHILE v_current_date <= v_end_limit AND v_count < 100 LOOP
    BEGIN
      -- CRUCIAL FIX: Create child event with explicit created_at
      INSERT INTO events (
        title, user_surname, user_number, social_network_link, event_notes,
        event_name, start_date, end_date, payment_status, payment_amount,
        user_id, type, is_recurring, repeat_pattern, repeat_until,
        parent_event_id, language, created_at
      ) VALUES (
        v_safe_title,  -- Use safe title
        v_safe_user_surname,  -- Use safe user_surname
        v_parent_event.user_number,
        v_parent_event.social_network_link,
        v_parent_event.event_notes,
        v_parent_event.event_name,
        v_current_date,
        v_current_date + v_event_duration,
        v_parent_event.payment_status,
        v_parent_event.payment_amount,
        p_user_id,
        COALESCE(v_parent_event.type, 'event'),
        false, -- Child events are not recurring themselves
        NULL,
        NULL,
        p_parent_event_id,
        COALESCE(v_parent_event.language, 'en'),
        now()  -- CRUCIAL FIX: Set created_at explicitly
      );
      
      -- Copy additional persons for this instance
      INSERT INTO customers (
        title, user_surname, user_number, social_network_link, event_notes,
        payment_status, payment_amount, user_id, event_id, type,
        start_date, end_date
      )
      SELECT 
        v_safe_user_surname,  -- Use safe values
        v_safe_user_surname,
        user_number, 
        social_network_link, 
        event_notes,
        payment_status, 
        payment_amount, 
        user_id, 
        currval('events_id_seq'::regclass), 
        type,
        v_current_date, 
        v_current_date + v_event_duration
      FROM customers 
      WHERE event_id = p_parent_event_id;
      
      v_count := v_count + 1;
      
      -- Calculate next occurrence
      CASE p_repeat_pattern
        WHEN 'daily' THEN v_current_date := v_current_date + INTERVAL '1 day';
        WHEN 'weekly' THEN v_current_date := v_current_date + INTERVAL '1 week';
        WHEN 'monthly' THEN v_current_date := v_current_date + INTERVAL '1 month';
        WHEN 'yearly' THEN v_current_date := v_current_date + INTERVAL '1 year';
      END CASE;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Error creating recurring event instance %: %', v_count + 1, SQLERRM;
        -- Continue with next iteration instead of failing completely
    END;
  END LOOP;
  
  RAISE NOTICE 'Successfully generated % recurring event instances', v_count;
  RETURN v_count;
END;
$$;
