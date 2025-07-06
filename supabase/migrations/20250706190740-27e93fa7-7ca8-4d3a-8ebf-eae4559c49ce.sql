
-- Update the generate_recurring_events function to properly handle biweekly pattern
CREATE OR REPLACE FUNCTION public.generate_recurring_events(p_parent_event_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_repeat_pattern text, p_repeat_until date, p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_current_start TIMESTAMPTZ := p_start_date;
  v_current_end TIMESTAMPTZ := p_end_date;
  v_counter INTEGER := 0;
  v_duration INTERVAL;
  v_max_iterations INTEGER := 1000; -- Safety limit
BEGIN
  -- Calculate duration between start and end
  v_duration := p_end_date - p_start_date;
  
  RAISE NOTICE 'Starting recurring event generation: parent=%, pattern=%, until=%, duration=%', 
               p_parent_event_id, p_repeat_pattern, p_repeat_until, v_duration;
  
  LOOP
    -- Safety check to prevent infinite loops
    IF v_counter >= v_max_iterations THEN
      RAISE WARNING 'Reached maximum iterations (%) for recurring event generation', v_max_iterations;
      EXIT;
    END IF;

    -- Calculate next occurrence
    IF p_repeat_pattern = 'daily' THEN
      v_current_start := v_current_start + INTERVAL '1 day';
    ELSIF p_repeat_pattern = 'weekly' THEN
      v_current_start := v_current_start + INTERVAL '1 week';
    ELSIF p_repeat_pattern = 'biweekly' THEN
      v_current_start := v_current_start + INTERVAL '2 weeks';
    ELSIF p_repeat_pattern = 'monthly' THEN
      v_current_start := v_current_start + INTERVAL '1 month';
    ELSIF p_repeat_pattern = 'yearly' THEN
      v_current_start := v_current_start + INTERVAL '1 year';
    ELSE
      RAISE WARNING 'Invalid repeat pattern: %', p_repeat_pattern;
      EXIT;
    END IF;
    
    -- Calculate new end time maintaining duration
    v_current_end := v_current_start + v_duration;

    -- Check if next start is beyond repeat_until (inclusive comparison)
    IF v_current_start::date > p_repeat_until THEN
      RAISE NOTICE 'Reached repeat_until date. Current start: %, repeat_until: %', 
                   v_current_start::date, p_repeat_until;
      EXIT;
    END IF;

    -- Insert the recurring instance
    INSERT INTO events (
      title, user_surname, user_number, social_network_link, event_notes, event_name,
      start_date, end_date, payment_status, payment_amount,
      user_id, type, is_recurring, repeat_pattern, repeat_until, parent_event_id,
      created_at
    )
    SELECT
      title, user_surname, user_number, social_network_link, event_notes, event_name,
      v_current_start, v_current_end, payment_status, payment_amount,
      user_id, type, is_recurring, repeat_pattern, repeat_until, id,
      NOW()
    FROM events WHERE id = p_parent_event_id;

    v_counter := v_counter + 1;
    
    RAISE NOTICE 'Created recurring instance #% with start_date: %', v_counter, v_current_start;
  END LOOP;

  RAISE NOTICE 'Completed recurring event generation: created % instances', v_counter;
  RETURN v_counter;
END;
$function$;
