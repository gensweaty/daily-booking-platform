
-- Replace the generate_recurring_events function with a robust version
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
BEGIN
  LOOP
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
      EXIT;
    END IF;

    -- Only create if next start is within repeat_until (inclusive)
    IF v_current_start::date > p_repeat_until THEN
      EXIT;
    END IF;

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

  RETURN v_counter;
END;
$$;
