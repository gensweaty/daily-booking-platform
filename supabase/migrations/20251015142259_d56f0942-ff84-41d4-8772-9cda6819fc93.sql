-- Drop existing update_event_series_safe function (all overloads)
DROP FUNCTION IF EXISTS public.update_event_series_safe(uuid, uuid, jsonb, jsonb, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_event_series_safe(uuid, uuid, jsonb, jsonb, text, text, boolean) CASCADE;

-- Recreate update_event_series_safe with AI parameter support
CREATE OR REPLACE FUNCTION public.update_event_series_safe(
  p_event_id uuid,
  p_user_id uuid,
  p_event_data jsonb,
  p_additional_persons jsonb,
  p_edited_by_type text,
  p_edited_by_name text,
  p_edited_by_ai boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
    last_edited_by_name = p_edited_by_name,
    last_edited_by_ai = p_edited_by_ai
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
    last_edited_by_name = p_edited_by_name,
    last_edited_by_ai = p_edited_by_ai
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
        created_by_ai,
        last_edited_by_type,
        last_edited_by_name,
        last_edited_by_ai
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
        p_edited_by_ai,
        COALESCE(p_edited_by_type, 'admin'),
        p_edited_by_name,
        p_edited_by_ai
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'parent_id', v_parent_id);
END;
$function$;