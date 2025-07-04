
-- Fix the generate_recurring_events function to include created_at
CREATE OR REPLACE FUNCTION public.generate_recurring_events(
  p_parent_event_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_repeat_pattern TEXT,
  p_repeat_until DATE,
  p_user_id UUID
) RETURNS INTEGER AS $$
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
      -- CRUCIAL FIX: Create child event with created_at column
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
        NOW()  -- CRUCIAL FIX: Set created_at
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also set a default value for created_at to future-proof the table
ALTER TABLE events ALTER COLUMN created_at SET DEFAULT NOW();
