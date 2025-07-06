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
  v_current_end   TIMESTAMPTZ := p_end_date;
  v_duration      INTERVAL    := p_end_date - p_start_date;
  v_counter       INTEGER     := 0;
  v_max_iterations INTEGER    := 1000;
BEGIN
  LOOP
    -- Add interval for next occurrence (the first run this increments by 1)
    CASE
      WHEN p_repeat_pattern = 'daily' THEN
        v_current_start := v_current_start + INTERVAL '1 day';
      WHEN p_repeat_pattern = 'weekly' THEN
        v_current_start := v_current_start + INTERVAL '1 week';
      WHEN p_repeat_pattern = 'biweekly' THEN
        v_current_start := v_current_start + INTERVAL '2 weeks';
      WHEN p_repeat_pattern = 'monthly' THEN
        v_current_start := v_current_start + INTERVAL '1 month';
      WHEN p_repeat_pattern = 'yearly' THEN
        v_current_start := v_current_start + INTERVAL '1 year';
      ELSE
        RAISE WARNING 'Invalid repeat pattern: %', p_repeat_pattern;
        EXIT;
    END CASE;
    v_current_end := v_current_start + v_duration;

    -- Stop if next start is after repeat_until
    IF v_current_start::date > p_repeat_until THEN
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
    IF v_counter >= v_max_iterations THEN
      RAISE WARNING 'Max iterations reached';
      EXIT;
    END IF;
  END LOOP;
  RETURN v_counter;
END;
$function$;
