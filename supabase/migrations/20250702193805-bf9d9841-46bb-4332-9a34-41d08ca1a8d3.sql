
-- Fix the generate_recurring_events function to handle null titles properly
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
      -- Create child event with safe values
      INSERT INTO events (
        title, user_surname, user_number, social_network_link, event_notes,
        event_name, start_date, end_date, payment_status, payment_amount,
        user_id, type, is_recurring, repeat_pattern, repeat_until,
        parent_event_id, language
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
        COALESCE(v_parent_event.language, 'en')
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

-- Also update save_event_with_persons to have better error handling for recurring events
CREATE OR REPLACE FUNCTION public.save_event_with_persons(
  p_event_data jsonb, 
  p_additional_persons jsonb, 
  p_user_id uuid, 
  p_event_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
  v_person JSONB;
  v_recurring_count INTEGER;
  v_safe_title TEXT;
  v_safe_user_surname TEXT;
BEGIN
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
    -- Create new event with safe values
    INSERT INTO events (
      title, user_surname, user_number, social_network_link, event_notes,
      event_name, start_date, end_date, payment_status, payment_amount,
      user_id, type, is_recurring, repeat_pattern, repeat_until
    ) VALUES (
      v_safe_title,  -- Use safe title
      v_safe_user_surname,  -- Use safe user_surname
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
      COALESCE((p_event_data->>'is_recurring')::boolean, false),
      p_event_data->>'repeat_pattern',
      CASE WHEN p_event_data->>'repeat_until' IS NOT NULL 
           THEN (p_event_data->>'repeat_until')::date 
           ELSE NULL END
    ) RETURNING id INTO v_event_id;
    
    RAISE NOTICE 'Created parent event % with title: %', v_event_id, v_safe_title;
    
    -- Generate recurring instances if this is a recurring event
    IF COALESCE((p_event_data->>'is_recurring')::boolean, false) = true 
       AND p_event_data->>'repeat_pattern' IS NOT NULL THEN
      
      RAISE NOTICE 'Generating recurring instances for event %', v_event_id;
      
      BEGIN
        SELECT generate_recurring_events(
          v_event_id,
          (p_event_data->>'start_date')::timestamptz,
          (p_event_data->>'end_date')::timestamptz,
          p_event_data->>'repeat_pattern',
          (p_event_data->>'repeat_until')::date,
          p_user_id
        ) INTO v_recurring_count;
        
        RAISE NOTICE 'Generated % recurring instances', v_recurring_count;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Error generating recurring events: %', SQLERRM;
          -- Don't fail the entire operation, just log the error
      END;
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
      is_recurring = COALESCE((p_event_data->>'is_recurring')::boolean, false),
      repeat_pattern = p_event_data->>'repeat_pattern',
      repeat_until = CASE WHEN p_event_data->>'repeat_until' IS NOT NULL 
                         THEN (p_event_data->>'repeat_until')::date 
                         ELSE NULL END
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
      (p_event_data->>'start_date')::timestamptz,
      (p_event_data->>'end_date')::timestamptz
    );
  END LOOP;

  RETURN v_event_id;
END;
$$;
