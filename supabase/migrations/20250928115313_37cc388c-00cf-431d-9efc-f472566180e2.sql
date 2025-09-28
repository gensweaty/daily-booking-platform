-- Drop existing functions first
DROP FUNCTION IF EXISTS update_event_series_safe(uuid,uuid,jsonb,jsonb,text,text);
DROP FUNCTION IF EXISTS edit_single_event_instance_v2(uuid,uuid,jsonb,jsonb,timestamptz,timestamptz,text,text);

-- Create safe update functions for recurring events
-- Function to safely update entire event series (preserves individual dates)
CREATE OR REPLACE FUNCTION update_event_series_safe(
  p_event_id uuid,
  p_user_id uuid,
  p_event_data jsonb,
  p_additional_persons jsonb,
  p_edited_by_type text,
  p_edited_by_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_id uuid;
  v_result jsonb;
  v_person jsonb;
  v_customer_id uuid;
BEGIN
  -- Get the parent event ID (in case we're dealing with a child instance)
  SELECT COALESCE(parent_event_id, id) INTO v_parent_id
  FROM events 
  WHERE id = p_event_id AND user_id = p_user_id;

  IF v_parent_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found or access denied');
  END IF;

  -- Update the parent event with new data (but preserve start_date and end_date)
  UPDATE events SET
    title = COALESCE((p_event_data->>'title')::text, title),
    user_surname = COALESCE((p_event_data->>'user_surname')::text, user_surname),
    user_number = COALESCE((p_event_data->>'user_number')::text, user_number),
    social_network_link = COALESCE((p_event_data->>'social_network_link')::text, social_network_link),
    event_notes = COALESCE((p_event_data->>'event_notes')::text, event_notes),
    event_name = COALESCE((p_event_data->>'event_name')::text, event_name),
    payment_status = COALESCE((p_event_data->>'payment_status')::text, payment_status),
    payment_amount = CASE 
      WHEN p_event_data->>'payment_amount' IS NOT NULL THEN (p_event_data->>'payment_amount')::numeric
      ELSE payment_amount
    END,
    reminder_at = CASE 
      WHEN p_event_data->>'reminder_at' IS NOT NULL THEN (p_event_data->>'reminder_at')::timestamptz
      ELSE reminder_at
    END,
    email_reminder_enabled = COALESCE((p_event_data->>'email_reminder_enabled')::boolean, email_reminder_enabled),
    updated_at = now(),
    last_edited_by_type = COALESCE(p_edited_by_type, 'admin'),
    last_edited_by_name = p_edited_by_name
  WHERE id = v_parent_id AND user_id = p_user_id;

  -- Update all child instances with the same data (but preserve their individual dates)
  UPDATE events SET
    title = COALESCE((p_event_data->>'title')::text, title),
    user_surname = COALESCE((p_event_data->>'user_surname')::text, user_surname),
    user_number = COALESCE((p_event_data->>'user_number')::text, user_number),
    social_network_link = COALESCE((p_event_data->>'social_network_link')::text, social_network_link),
    event_notes = COALESCE((p_event_data->>'event_notes')::text, event_notes),
    event_name = COALESCE((p_event_data->>'event_name')::text, event_name),
    payment_status = COALESCE((p_event_data->>'payment_status')::text, payment_status),
    payment_amount = CASE 
      WHEN p_event_data->>'payment_amount' IS NOT NULL THEN (p_event_data->>'payment_amount')::numeric
      ELSE payment_amount
    END,
    reminder_at = CASE 
      WHEN p_event_data->>'reminder_at' IS NOT NULL THEN (p_event_data->>'reminder_at')::timestamptz
      ELSE reminder_at
    END,
    email_reminder_enabled = COALESCE((p_event_data->>'email_reminder_enabled')::boolean, email_reminder_enabled),
    updated_at = now(),
    last_edited_by_type = COALESCE(p_edited_by_type, 'admin'),
    last_edited_by_name = p_edited_by_name
  WHERE parent_event_id = v_parent_id AND user_id = p_user_id AND deleted_at IS NULL;

  -- Handle additional persons (update for the parent event)
  IF p_additional_persons IS NOT NULL AND jsonb_array_length(p_additional_persons) > 0 THEN
    -- Delete existing additional persons for this event
    DELETE FROM customers 
    WHERE event_id = v_parent_id AND type = 'customer' AND user_id = p_user_id;

    -- Insert new additional persons
    FOR v_person IN SELECT * FROM jsonb_array_elements(p_additional_persons)
    LOOP
      INSERT INTO customers (
        event_id,
        user_id,
        title,
        user_surname,
        user_number,
        social_network_link,
        event_notes,
        payment_status,
        payment_amount,
        type,
        created_by_type,
        created_by_name,
        last_edited_by_type,
        last_edited_by_name
      ) VALUES (
        v_parent_id,
        p_user_id,
        (v_person->>'userSurname')::text,
        (v_person->>'userSurname')::text,
        (v_person->>'userNumber')::text,
        (v_person->>'socialNetworkLink')::text,
        (v_person->>'eventNotes')::text,
        (v_person->>'paymentStatus')::text,
        CASE 
          WHEN v_person->>'paymentAmount' IS NOT NULL AND v_person->>'paymentAmount' != '' 
          THEN (v_person->>'paymentAmount')::numeric
          ELSE NULL
        END,
        'customer',
        COALESCE(p_edited_by_type, 'admin'),
        p_edited_by_name,
        COALESCE(p_edited_by_type, 'admin'),
        p_edited_by_name
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'parent_id', v_parent_id);
END;
$$;

-- Function to safely edit a single instance of a recurring event
CREATE OR REPLACE FUNCTION edit_single_event_instance_v2(
  p_event_id uuid,
  p_user_id uuid,
  p_event_data jsonb,
  p_additional_persons jsonb,
  p_instance_start timestamptz,
  p_instance_end timestamptz,
  p_edited_by_type text,
  p_edited_by_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_id uuid;
  v_new_event_id uuid;
  v_person jsonb;
  v_parent_event events%ROWTYPE;
BEGIN
  -- Get the parent event (in case we're dealing with a child instance)
  SELECT COALESCE(parent_event_id, id) INTO v_parent_id
  FROM events 
  WHERE id = p_event_id AND user_id = p_user_id;

  IF v_parent_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found or access denied');
  END IF;

  -- Get parent event data to copy non-date fields
  SELECT * INTO v_parent_event FROM events WHERE id = v_parent_id;

  -- Create a new standalone event with the updated data
  INSERT INTO events (
    title,
    user_surname,
    user_number,
    social_network_link,
    event_notes,
    event_name,
    start_date,
    end_date,
    payment_status,
    payment_amount,
    type,
    user_id,
    is_recurring,
    reminder_at,
    email_reminder_enabled,
    language,
    created_by_type,
    created_by_name,
    last_edited_by_type,
    last_edited_by_name
  ) VALUES (
    COALESCE((p_event_data->>'title')::text, v_parent_event.title),
    COALESCE((p_event_data->>'user_surname')::text, v_parent_event.user_surname),
    COALESCE((p_event_data->>'user_number')::text, v_parent_event.user_number),
    COALESCE((p_event_data->>'social_network_link')::text, v_parent_event.social_network_link),
    COALESCE((p_event_data->>'event_notes')::text, v_parent_event.event_notes),
    COALESCE((p_event_data->>'event_name')::text, v_parent_event.event_name),
    p_instance_start,
    p_instance_end,
    COALESCE((p_event_data->>'payment_status')::text, v_parent_event.payment_status),
    CASE 
      WHEN p_event_data->>'payment_amount' IS NOT NULL THEN (p_event_data->>'payment_amount')::numeric
      ELSE v_parent_event.payment_amount
    END,
    COALESCE(v_parent_event.type, 'event'),
    p_user_id,
    false, -- New standalone event is not recurring
    CASE 
      WHEN p_event_data->>'reminder_at' IS NOT NULL THEN (p_event_data->>'reminder_at')::timestamptz
      ELSE v_parent_event.reminder_at
    END,
    COALESCE((p_event_data->>'email_reminder_enabled')::boolean, v_parent_event.email_reminder_enabled),
    COALESCE((p_event_data->>'language')::text, v_parent_event.language, 'en'),
    COALESCE(p_edited_by_type, 'admin'),
    p_edited_by_name,
    COALESCE(p_edited_by_type, 'admin'),
    p_edited_by_name
  ) RETURNING id INTO v_new_event_id;

  -- Mark this specific instance as excluded from the parent series
  INSERT INTO events (
    title,
    user_surname,
    user_number,
    social_network_link,
    event_notes,
    event_name,
    start_date,
    end_date,
    payment_status,
    payment_amount,
    type,
    user_id,
    parent_event_id,
    excluded_from_series,
    language,
    created_by_type,
    created_by_name,
    last_edited_by_type,
    last_edited_by_name
  ) VALUES (
    v_parent_event.title,
    v_parent_event.user_surname,
    v_parent_event.user_number,
    v_parent_event.social_network_link,
    v_parent_event.event_notes,
    v_parent_event.event_name,
    p_instance_start,
    p_instance_end,
    v_parent_event.payment_status,
    v_parent_event.payment_amount,
    v_parent_event.type,
    p_user_id,
    v_parent_id,
    true, -- Mark as excluded
    COALESCE(v_parent_event.language, 'en'),
    COALESCE(p_edited_by_type, 'admin'),
    p_edited_by_name,
    COALESCE(p_edited_by_type, 'admin'),
    p_edited_by_name
  );

  -- Handle additional persons for the new standalone event
  IF p_additional_persons IS NOT NULL AND jsonb_array_length(p_additional_persons) > 0 THEN
    FOR v_person IN SELECT * FROM jsonb_array_elements(p_additional_persons)
    LOOP
      INSERT INTO customers (
        event_id,
        user_id,
        title,
        user_surname,
        user_number,
        social_network_link,
        event_notes,
        payment_status,
        payment_amount,
        type,
        created_by_type,
        created_by_name,
        last_edited_by_type,
        last_edited_by_name
      ) VALUES (
        v_new_event_id,
        p_user_id,
        (v_person->>'userSurname')::text,
        (v_person->>'userSurname')::text,
        (v_person->>'userNumber')::text,
        (v_person->>'socialNetworkLink')::text,
        (v_person->>'eventNotes')::text,
        (v_person->>'paymentStatus')::text,
        CASE 
          WHEN v_person->>'paymentAmount' IS NOT NULL AND v_person->>'paymentAmount' != '' 
          THEN (v_person->>'paymentAmount')::numeric
          ELSE NULL
        END,
        'customer',
        COALESCE(p_edited_by_type, 'admin'),
        p_edited_by_name,
        COALESCE(p_edited_by_type, 'admin'),
        p_edited_by_name
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'new_event_id', v_new_event_id);
END;
$$;