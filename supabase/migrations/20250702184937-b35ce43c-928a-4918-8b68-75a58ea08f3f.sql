
-- Create function to generate recurring event instances
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
BEGIN
  -- Get parent event data
  SELECT * INTO v_parent_event FROM events WHERE id = p_parent_event_id;
  
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
    ELSE RETURN 0;
  END CASE;
  
  -- Generate recurring instances
  WHILE v_current_date <= v_end_limit AND v_count < 100 LOOP
    -- Create child event
    INSERT INTO events (
      title, user_surname, user_number, social_network_link, event_notes,
      event_name, start_date, end_date, payment_status, payment_amount,
      user_id, type, is_recurring, repeat_pattern, repeat_until,
      parent_event_id, language
    ) VALUES (
      v_parent_event.title,
      v_parent_event.user_surname,
      v_parent_event.user_number,
      v_parent_event.social_network_link,
      v_parent_event.event_notes,
      v_parent_event.event_name,
      v_current_date,
      v_current_date + v_event_duration,
      v_parent_event.payment_status,
      v_parent_event.payment_amount,
      p_user_id,
      v_parent_event.type,
      false, -- Child events are not recurring themselves
      NULL,
      NULL,
      p_parent_event_id,
      v_parent_event.language
    );
    
    -- Copy additional persons for this instance
    INSERT INTO customers (
      title, user_surname, user_number, social_network_link, event_notes,
      payment_status, payment_amount, user_id, event_id, type,
      start_date, end_date
    )
    SELECT 
      title, user_surname, user_number, social_network_link, event_notes,
      payment_status, payment_amount, user_id, currval('events_id_seq'::regclass), type,
      v_current_date, v_current_date + v_event_duration
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
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Update the save_event_with_persons function to handle recurring events
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
BEGIN
  -- Insert or update the main event
  IF p_event_id IS NULL THEN
    -- Create new event
    INSERT INTO events (
      title, user_surname, user_number, social_network_link, event_notes,
      event_name, start_date, end_date, payment_status, payment_amount,
      user_id, type, is_recurring, repeat_pattern, repeat_until
    ) VALUES (
      p_event_data->>'title',
      p_event_data->>'user_surname', 
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
    
    -- Generate recurring instances if this is a recurring event
    IF COALESCE((p_event_data->>'is_recurring')::boolean, false) = true 
       AND p_event_data->>'repeat_pattern' IS NOT NULL THEN
      SELECT generate_recurring_events(
        v_event_id,
        (p_event_data->>'start_date')::timestamptz,
        (p_event_data->>'end_date')::timestamptz,
        p_event_data->>'repeat_pattern',
        (p_event_data->>'repeat_until')::date,
        p_user_id
      ) INTO v_recurring_count;
    END IF;
    
  ELSE
    -- Update existing event
    UPDATE events SET
      title = p_event_data->>'title',
      user_surname = p_event_data->>'user_surname',
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
      v_person->>'userSurname',
      v_person->>'userSurname',
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

-- Create function to delete recurring event series
CREATE OR REPLACE FUNCTION public.delete_recurring_series(
  p_event_id UUID,
  p_user_id UUID,
  p_delete_choice TEXT DEFAULT 'this'
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_id UUID;
  v_deleted_count INTEGER := 0;
BEGIN
  -- Get parent event ID if this is a child event
  SELECT COALESCE(parent_event_id, id) INTO v_parent_id 
  FROM events 
  WHERE id = p_event_id AND user_id = p_user_id;
  
  IF v_parent_id IS NULL THEN
    RETURN 0;
  END IF;
  
  IF p_delete_choice = 'series' THEN
    -- Delete entire series (parent + all children)
    UPDATE events 
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id 
    AND (id = v_parent_id OR parent_event_id = v_parent_id);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  ELSE
    -- Delete only this specific event
    UPDATE events 
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = p_event_id AND user_id = p_user_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  END IF;
  
  RETURN v_deleted_count;
END;
$$;
