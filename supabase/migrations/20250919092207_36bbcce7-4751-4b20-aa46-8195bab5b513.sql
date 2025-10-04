-- Add series-wide event editing functionality
-- This function handles updating entire event series with all their data

CREATE OR REPLACE FUNCTION public.update_event_series(
  p_event_id uuid, 
  p_user_id uuid,
  p_event_data jsonb,
  p_additional_persons jsonb,
  p_edited_by_type text DEFAULT 'admin',
  p_edited_by_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_parent_event_id uuid;
  v_is_recurring boolean;
  v_series_event_ids uuid[];
  v_updated_count integer := 0;
  v_result jsonb;
  v_event_record events%ROWTYPE;
BEGIN
  -- Get the event record to determine if it's part of a series
  SELECT * INTO v_event_record
  FROM events 
  WHERE id = p_event_id AND user_id = p_user_id;
  
  IF v_event_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;
  
  v_is_recurring := v_event_record.is_recurring;
  v_parent_event_id := v_event_record.parent_event_id;
  
  -- Determine the parent event ID for the series
  IF v_is_recurring = true AND v_parent_event_id IS NULL THEN
    -- This is the parent event
    v_parent_event_id := p_event_id;
  ELSIF v_parent_event_id IS NOT NULL THEN
    -- This is a child event, use its parent
    v_parent_event_id := v_parent_event_id;
  ELSE
    -- Single event, no series to update
    RETURN jsonb_build_object('success', false, 'error', 'Not a recurring event series');
  END IF;
  
  -- Get all events in the series (parent + children)
  SELECT ARRAY_AGG(id) INTO v_series_event_ids
  FROM events 
  WHERE user_id = p_user_id 
    AND (id = v_parent_event_id OR parent_event_id = v_parent_event_id)
    AND deleted_at IS NULL;
  
  RAISE NOTICE '🔄 Updating event series: parent_id=%, series_count=%', 
               v_parent_event_id, array_length(v_series_event_ids, 1);
  
  -- Update all events in the series with the new data
  -- Note: For recurring events, we typically only update non-date fields series-wide
  -- Date fields should be handled carefully to maintain the recurring pattern
  UPDATE events SET
    title = COALESCE(p_event_data->>'title', title),
    user_surname = COALESCE(p_event_data->>'user_surname', user_surname),
    user_number = COALESCE(p_event_data->>'user_number', user_number),
    social_network_link = COALESCE(p_event_data->>'social_network_link', social_network_link),
    event_notes = COALESCE(p_event_data->>'event_notes', event_notes),
    event_name = COALESCE(p_event_data->>'event_name', event_name),
    payment_status = COALESCE(p_event_data->>'payment_status', payment_status),
    payment_amount = CASE 
      WHEN p_event_data->>'payment_amount' IS NOT NULL AND p_event_data->>'payment_amount' != '' 
      THEN (p_event_data->>'payment_amount')::numeric 
      ELSE payment_amount 
    END,
    reminder_at = CASE 
      WHEN p_event_data->>'reminder_at' IS NOT NULL AND p_event_data->>'reminder_at' != '' 
      THEN (p_event_data->>'reminder_at')::timestamptz 
      ELSE reminder_at 
    END,
    email_reminder_enabled = COALESCE((p_event_data->>'email_reminder_enabled')::boolean, email_reminder_enabled),
    last_edited_by_type = p_edited_by_type,
    last_edited_by_name = p_edited_by_name,
    updated_at = NOW()
  WHERE id = ANY(v_series_event_ids);
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Update customers for all events in the series
  -- First delete existing customers for all events in the series
  DELETE FROM customers 
  WHERE event_id = ANY(v_series_event_ids) 
    AND user_id = p_user_id 
    AND type = 'customer';
  
  -- Then insert new customers for all events in the series
  IF jsonb_array_length(p_additional_persons) > 0 THEN
    -- Insert customer records for each person and each event in the series
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
      event_id,
      'customer',
      e.start_date,
      e.end_date,
      p_edited_by_type,
      p_edited_by_name,
      p_edited_by_type,
      p_edited_by_name
    FROM jsonb_array_elements(p_additional_persons) AS person
    CROSS JOIN unnest(v_series_event_ids) AS event_id
    JOIN events e ON e.id = event_id;
  END IF;
  
  RAISE NOTICE '✅ Series update complete: updated % events, parent_id=%', 
               v_updated_count, v_parent_event_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'updated_count', v_updated_count,
    'parent_event_id', v_parent_event_id,
    'series_event_ids', to_jsonb(v_series_event_ids)
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error updating event series: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;