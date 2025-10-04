
-- Fix the generate_recurring_events function with correct loop logic
CREATE OR REPLACE FUNCTION public.generate_recurring_events(
  p_parent_event_id uuid,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_repeat_pattern text,
  p_repeat_until date,
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  v_current_start TIMESTAMPTZ := p_start_date;
  v_current_end TIMESTAMPTZ := p_end_date;
  v_duration INTERVAL := p_end_date - p_start_date;
  v_counter INTEGER := 0;
  v_max_iterations INTEGER := 1000;
BEGIN
  RAISE NOTICE 'Starting recurring event generation: parent=%, pattern=%, until=%, duration=%', 
               p_parent_event_id, p_repeat_pattern, p_repeat_until, v_duration;

  -- Loop: increment first, then check exit condition, then insert
  LOOP
    -- Safety check to prevent infinite loops
    IF v_counter >= v_max_iterations THEN
      RAISE WARNING 'Reached maximum iterations (%) for recurring event generation', v_max_iterations;
      EXIT;
    END IF;

    -- Increment to next occurrence first
    v_current_start := v_current_start + 
      CASE 
        WHEN p_repeat_pattern = 'daily' THEN INTERVAL '1 day'
        WHEN p_repeat_pattern = 'weekly' THEN INTERVAL '1 week'
        WHEN p_repeat_pattern = 'biweekly' THEN INTERVAL '2 weeks'
        WHEN p_repeat_pattern = 'monthly' THEN INTERVAL '1 month'
        WHEN p_repeat_pattern = 'yearly' THEN INTERVAL '1 year'
        ELSE NULL
      END;

    -- If pattern is invalid, exit
    IF v_current_start IS NULL THEN
      RAISE WARNING 'Invalid repeat pattern: %', p_repeat_pattern;
      EXIT;
    END IF;

    v_current_end := v_current_start + v_duration;

    -- Check if we've gone past the repeat_until date
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
