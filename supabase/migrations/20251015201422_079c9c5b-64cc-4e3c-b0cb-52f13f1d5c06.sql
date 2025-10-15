-- Fix edit_single_event_instance_v2 to prevent duplicate events when editing first instance

DROP FUNCTION IF EXISTS public.edit_single_event_instance_v2(uuid, uuid, jsonb, jsonb, timestamp with time zone, timestamp with time zone, text, text, boolean) CASCADE;

CREATE OR REPLACE FUNCTION public.edit_single_event_instance_v2(
  p_event_id uuid,
  p_user_id uuid,
  p_event_data jsonb,
  p_additional_persons jsonb,
  p_instance_start timestamp with time zone,
  p_instance_end timestamp with time zone,
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
  v_new_event_id uuid;
  v_person jsonb;
  v_parent_event events%ROWTYPE;
  v_is_first_instance boolean;
BEGIN
  -- Get the parent event (in case we're dealing with a child instance)
  SELECT COALESCE(parent_event_id, id) INTO v_parent_id
  FROM events 
  WHERE id = p_event_id AND user_id = p_user_id;

  IF v_parent_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found or access denied');
  END IF;

  -- Get parent event data
  SELECT * INTO v_parent_event FROM events WHERE id = v_parent_id;

  -- Check if we're editing the first instance (parent's original date)
  v_is_first_instance := (
    v_parent_event.start_date = p_instance_start AND 
    v_parent_event.end_date = p_instance_end
  );

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
    created_by_ai,
    last_edited_by_type,
    last_edited_by_name,
    last_edited_by_ai
  ) VALUES (
    COALESCE((p_event_data->>'title')::text, v_parent_event.title),
    COALESCE((p_event_data->>'user_surname')::text, v_parent_event.user_surname),
    COALESCE((p_event_data->>'user_number')::text, v_parent_event.user_number),
    COALESCE((p_event_data->>'social_network_link')::text, v_parent_event.social_network_link),
    COALESCE((p_event_data->>'event_notes')::text, v_parent_event.event_notes),
    COALESCE((p_event_data->>'event_name')::text, v_parent_event.event_name),
    -- Use the NEW edited dates from p_event_data if provided, otherwise use instance window
    COALESCE((p_event_data->>'start_date')::timestamptz, p_instance_start),
    COALESCE((p_event_data->>'end_date')::timestamptz, p_instance_end),
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
    p_edited_by_ai,
    COALESCE(p_edited_by_type, 'admin'),
    p_edited_by_name,
    p_edited_by_ai
  ) RETURNING id INTO v_new_event_id;

  -- Handle exclusion differently based on whether this is the first instance
  IF v_is_first_instance THEN
    -- For first instance, mark the parent itself as excluded
    UPDATE events 
    SET excluded_from_series = true,
        last_edited_by_type = COALESCE(p_edited_by_type, 'admin'),
        last_edited_by_name = p_edited_by_name,
        last_edited_by_ai = p_edited_by_ai,
        updated_at = now()
    WHERE id = v_parent_id;
  ELSE
    -- For non-first instances, create an exclusion marker event
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
      created_by_ai,
      last_edited_by_type,
      last_edited_by_name,
      last_edited_by_ai
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
      p_edited_by_ai,
      COALESCE(p_edited_by_type, 'admin'),
      p_edited_by_name,
      p_edited_by_ai
    );
  END IF;

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
        created_by_ai,
        last_edited_by_type,
        last_edited_by_name,
        last_edited_by_ai
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
        p_edited_by_ai,
        COALESCE(p_edited_by_type, 'admin'),
        p_edited_by_name,
        p_edited_by_ai
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'new_event_id', v_new_event_id, 'is_first_instance', v_is_first_instance);
END;
$function$;