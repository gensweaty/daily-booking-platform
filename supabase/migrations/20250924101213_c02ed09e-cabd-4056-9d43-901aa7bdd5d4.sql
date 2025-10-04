-- Create the new surgical RPC function for editing single event instances
CREATE OR REPLACE FUNCTION public.edit_single_event_instance_v2(
  p_event_id uuid,                     -- parent id OR real child id
  p_user_id uuid,
  p_event_data jsonb,                  -- the edited fields
  p_additional_persons jsonb,          -- same as before
  p_instance_start timestamptz DEFAULT NULL,  -- REQUIRED for virtual instance
  p_instance_end   timestamptz DEFAULT NULL,  -- REQUIRED for virtual instance
  p_edited_by_type text DEFAULT 'admin',
  p_edited_by_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row           events%ROWTYPE;
  v_parent_id     uuid;
  v_instance_start timestamptz;
  v_instance_end   timestamptz;
  v_exclusion_id  uuid;
  v_new_id        uuid;
BEGIN
  SELECT * INTO v_row
  FROM events
  WHERE id = p_event_id AND user_id = p_user_id;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Determine parent + instance dates safely
  IF v_row.parent_event_id IS NOT NULL THEN
    v_parent_id      := v_row.parent_event_id;
    v_instance_start := COALESCE(p_instance_start, v_row.start_date);
    v_instance_end   := COALESCE(p_instance_end,   v_row.end_date);
    
    -- Mark THIS child as excluded (if it's already a concrete child)
    UPDATE events
      SET excluded_from_series = TRUE,
          last_edited_by_type = p_edited_by_type,
          last_edited_by_name = p_edited_by_name,
          updated_at = NOW()
    WHERE id = v_row.id;
    v_exclusion_id := v_row.id;

  ELSIF v_row.is_recurring THEN
    v_parent_id      := v_row.id;
    v_instance_start := COALESCE(p_instance_start, v_row.start_date);
    v_instance_end   := COALESCE(p_instance_end,   v_row.end_date);

    -- Create a lightweight child "exception marker" for just this occurrence
    INSERT INTO events (
      title, user_surname, user_number, social_network_link, event_notes,
      event_name, start_date, end_date, payment_status, payment_amount,
      user_id, type, is_recurring, parent_event_id, excluded_from_series,
      created_by_type, created_by_name, last_edited_by_type, last_edited_by_name,
      created_at, updated_at
    ) VALUES (
      v_row.title, v_row.user_surname, v_row.user_number, v_row.social_network_link, v_row.event_notes,
      v_row.event_name, v_instance_start, v_instance_end, v_row.payment_status, v_row.payment_amount,
      p_user_id, COALESCE(v_row.type, 'event'), FALSE, v_parent_id, TRUE,
      p_edited_by_type, p_edited_by_name, p_edited_by_type, p_edited_by_name,
      NOW(), NOW()
    )
    RETURNING id INTO v_exclusion_id;

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Event is not part of a recurring series');
  END IF;

  -- Create the new standalone edited event AT THE INSTANCE DATES
  INSERT INTO events (
    title, user_surname, user_number, social_network_link, event_notes,
    event_name, start_date, end_date, payment_status, payment_amount,
    user_id, type, is_recurring, parent_event_id,
    reminder_at, email_reminder_enabled, language,
    created_by_type, created_by_name, last_edited_by_type, last_edited_by_name,
    created_at, updated_at
  ) VALUES (
    COALESCE(p_event_data->>'title', v_row.title),
    COALESCE(p_event_data->>'user_surname', v_row.user_surname),
    COALESCE(p_event_data->>'user_number', v_row.user_number),
    COALESCE(p_event_data->>'social_network_link', v_row.social_network_link),
    COALESCE(p_event_data->>'event_notes', v_row.event_notes),
    COALESCE(p_event_data->>'event_name', v_row.event_name),

    COALESCE(NULLIF(p_event_data->>'start_date','')::timestamptz, v_instance_start),
    COALESCE(NULLIF(p_event_data->>'end_date','')::timestamptz,   v_instance_end),

    COALESCE(p_event_data->>'payment_status', v_row.payment_status),
    CASE WHEN NULLIF(p_event_data->>'payment_amount','') IS NOT NULL
         THEN (p_event_data->>'payment_amount')::numeric
         ELSE v_row.payment_amount END,

    p_user_id,
    COALESCE(p_event_data->>'type', v_row.type, 'event'),
    FALSE,
    NULL,

    CASE WHEN NULLIF(p_event_data->>'reminder_at','') IS NOT NULL
         THEN (p_event_data->>'reminder_at')::timestamptz
         ELSE v_row.reminder_at END,
    COALESCE((p_event_data->>'email_reminder_enabled')::boolean, v_row.email_reminder_enabled),
    COALESCE(p_event_data->>'language', v_row.language, 'en'),

    p_edited_by_type, p_edited_by_name, p_edited_by_type, p_edited_by_name,
    NOW(), NOW()
  )
  RETURNING id INTO v_new_id;

  -- (Optional) replicate additional persons onto the new standalone
  IF COALESCE(jsonb_array_length(p_additional_persons), 0) > 0 THEN
    INSERT INTO customers (
      title, user_surname, user_number, social_network_link, event_notes,
      payment_status, payment_amount, user_id, event_id, type,
      start_date, end_date,
      created_by_type, created_by_name, last_edited_by_type, last_edited_by_name
    )
    SELECT 
      COALESCE(NULLIF(trim(p->>'userSurname'), ''), 'Unknown'),
      COALESCE(NULLIF(trim(p->>'userSurname'), ''), 'Unknown'),
      p->>'userNumber',
      p->>'socialNetworkLink',
      p->>'eventNotes',
      p->>'paymentStatus',
      NULLIF(p->>'paymentAmount','')::numeric,
      p_user_id,
      v_new_id,
      'customer',
      COALESCE(NULLIF(p_event_data->>'start_date','')::timestamptz, v_instance_start),
      COALESCE(NULLIF(p_event_data->>'end_date','')::timestamptz,   v_instance_end),
      p_edited_by_type, p_edited_by_name, p_edited_by_type, p_edited_by_name
    FROM jsonb_array_elements(p_additional_persons) AS p;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'excluded_event_id', v_exclusion_id,
    'new_event_id', v_new_id,
    'parent_event_id', v_parent_id,
    'instance_start_date', v_instance_start,
    'instance_end_date', v_instance_end
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;