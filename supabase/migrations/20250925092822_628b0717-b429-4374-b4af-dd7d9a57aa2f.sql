-- Harden the series RPC to always operate on the series root and never touch dates/repeat fields
CREATE OR REPLACE FUNCTION public.update_event_series_safe(
  p_event_id uuid,
  p_user_id uuid,
  p_event_data jsonb,
  p_additional_persons jsonb DEFAULT '[]'::jsonb,
  p_edited_by_type text DEFAULT 'admin',
  p_edited_by_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row          events%ROWTYPE;
  v_root_id      uuid;
  v_updated_count integer := 0;
BEGIN
  SELECT * INTO v_row
  FROM events
  WHERE id = p_event_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Always operate on the series root
  v_root_id := COALESCE(v_row.parent_event_id, v_row.id);

  -- Update parent + all non-excluded children, but NEVER change dates/recurrence
  UPDATE events e
     SET title                   = COALESCE(p_event_data->>'title', e.title),
         user_surname            = COALESCE(p_event_data->>'user_surname', e.user_surname),
         user_number             = COALESCE(p_event_data->>'user_number', e.user_number),
         social_network_link     = COALESCE(p_event_data->>'social_network_link', e.social_network_link),
         event_notes             = COALESCE(p_event_data->>'event_notes', e.event_notes),
         event_name              = COALESCE(p_event_data->>'event_name', e.event_name),
         payment_status          = COALESCE(p_event_data->>'payment_status', e.payment_status),
         payment_amount          = COALESCE(NULLIF(p_event_data->>'payment_amount','')::numeric, e.payment_amount),
         reminder_at             = COALESCE(NULLIF(p_event_data->>'reminder_at','')::timestamptz, e.reminder_at),
         email_reminder_enabled  = COALESCE((p_event_data->>'email_reminder_enabled')::boolean, e.email_reminder_enabled),
         last_edited_by_type     = p_edited_by_type,
         last_edited_by_name     = p_edited_by_name,
         updated_at              = NOW()
   WHERE (e.id = v_root_id OR e.parent_event_id = v_root_id)
     AND COALESCE(e.excluded_from_series, FALSE) = FALSE
     AND e.user_id = p_user_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Update customers for all events in the series
  -- First delete existing customers for all events in the series
  DELETE FROM customers 
  WHERE event_id IN (
    SELECT id FROM events 
    WHERE (id = v_root_id OR parent_event_id = v_root_id)
      AND COALESCE(excluded_from_series, FALSE) = FALSE
      AND user_id = p_user_id
  )
  AND user_id = p_user_id 
  AND type = 'customer';

  -- Then insert new customers for all events in the series if provided
  IF COALESCE(jsonb_array_length(p_additional_persons), 0) > 0 THEN
    INSERT INTO customers (
      title, user_surname, user_number, social_network_link, event_notes,
      payment_status, payment_amount, user_id, event_id, type,
      start_date, end_date,
      created_by_type, created_by_name, last_edited_by_type, last_edited_by_name
    )
    SELECT 
      COALESCE(NULLIF(trim(person->>'userSurname'), ''), 'Unknown'),
      COALESCE(NULLIF(trim(person->>'userSurname'), ''), 'Unknown'),
      person->>'userNumber',
      person->>'socialNetworkLink', 
      person->>'eventNotes',
      person->>'paymentStatus',
      CASE WHEN person->>'paymentAmount' = '' THEN NULL 
           ELSE (person->>'paymentAmount')::numeric END,
      p_user_id,
      e.id,
      'customer',
      e.start_date,
      e.end_date,
      p_edited_by_type,
      p_edited_by_name,
      p_edited_by_type,
      p_edited_by_name
    FROM jsonb_array_elements(p_additional_persons) AS person
    CROSS JOIN (
      SELECT id, start_date, end_date FROM events 
      WHERE (id = v_root_id OR parent_event_id = v_root_id)
        AND COALESCE(excluded_from_series, FALSE) = FALSE
        AND user_id = p_user_id
    ) e;
  END IF;

  RETURN jsonb_build_object('success', true, 'updated_count', v_updated_count, 'root_event_id', v_root_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;