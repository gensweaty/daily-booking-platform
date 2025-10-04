CREATE OR REPLACE FUNCTION public.edit_single_event_instance(
  p_event_id uuid, 
  p_user_id uuid, 
  p_event_data jsonb, 
  p_additional_persons jsonb, 
  p_edited_by_type text DEFAULT 'admin'::text, 
  p_edited_by_name text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_original_event events%ROWTYPE;
  v_new_event_id uuid;
  v_parent_event_id uuid;
  v_instance_start_date timestamptz;
  v_instance_end_date timestamptz;
  v_result jsonb;
  v_event_to_exclude uuid;
BEGIN
  -- Get the original event details
  SELECT * INTO v_original_event
  FROM events 
  WHERE id = p_event_id AND user_id = p_user_id;
  
  IF v_original_event IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- CRITICAL FIX: Determine what we're working with
  IF v_original_event.parent_event_id IS NOT NULL THEN
    -- This is a child event - use its own dates and exclude it
    v_parent_event_id := v_original_event.parent_event_id;
    v_instance_start_date := v_original_event.start_date;
    v_instance_end_date := v_original_event.end_date;
    v_event_to_exclude := p_event_id;
  ELSIF v_original_event.is_recurring THEN
    -- This is the parent event - use its dates and exclude it
    v_parent_event_id := p_event_id;
    v_instance_start_date := v_original_event.start_date;
    v_instance_end_date := v_original_event.end_date;
    v_event_to_exclude := p_event_id;
  ELSE
    -- This is already a standalone event
    RETURN jsonb_build_object('success', false, 'error', 'Event is not part of a recurring series');
  END IF;

  RAISE NOTICE '🔄 Creating standalone event from instance: original_id=%, parent_id=%, event_to_exclude=%, instance_dates=%-%', 
               p_event_id, v_parent_event_id, v_event_to_exclude, v_instance_start_date, v_instance_end_date;

  -- Step 1: Mark the SPECIFIC event instance as excluded from series
  UPDATE events 
  SET excluded_from_series = TRUE,
      last_edited_by_type = p_edited_by_type,
      last_edited_by_name = p_edited_by_name,
      updated_at = NOW()
  WHERE id = v_event_to_exclude;

  -- Step 2: Create new standalone event with the edited data
  -- CRITICAL: Use the provided dates if given, otherwise use the instance dates
  INSERT INTO events (
    title, user_surname, user_number, social_network_link, event_notes,
    event_name, start_date, end_date, payment_status, payment_amount,
    user_id, type, is_recurring, parent_event_id,
    reminder_at, email_reminder_enabled, language,
    created_by_type, created_by_name, last_edited_by_type, last_edited_by_name,
    created_at, updated_at
  ) VALUES (
    COALESCE(p_event_data->>'title', v_original_event.title),
    COALESCE(p_event_data->>'user_surname', v_original_event.user_surname),
    COALESCE(p_event_data->>'user_number', v_original_event.user_number),
    COALESCE(p_event_data->>'social_network_link', v_original_event.social_network_link),
    COALESCE(p_event_data->>'event_notes', v_original_event.event_notes),
    COALESCE(p_event_data->>'event_name', v_original_event.event_name),
    -- CRITICAL: Only use provided dates if they exist, otherwise keep instance dates
    CASE 
      WHEN p_event_data->>'start_date' IS NOT NULL AND p_event_data->>'start_date' != v_instance_start_date::text
      THEN (p_event_data->>'start_date')::timestamptz 
      ELSE v_instance_start_date
    END,
    CASE 
      WHEN p_event_data->>'end_date' IS NOT NULL AND p_event_data->>'end_date' != v_instance_end_date::text
      THEN (p_event_data->>'end_date')::timestamptz 
      ELSE v_instance_end_date
    END,
    COALESCE(p_event_data->>'payment_status', v_original_event.payment_status),
    CASE 
      WHEN p_event_data->>'payment_amount' IS NOT NULL AND p_event_data->>'payment_amount' != '' 
      THEN (p_event_data->>'payment_amount')::numeric 
      ELSE v_original_event.payment_amount 
    END,
    p_user_id,
    COALESCE(p_event_data->>'type', v_original_event.type, 'event'),
    FALSE, -- New standalone event is not recurring
    NULL,  -- No parent event ID for standalone event
    CASE 
      WHEN p_event_data->>'reminder_at' IS NOT NULL AND p_event_data->>'reminder_at' != '' 
      THEN (p_event_data->>'reminder_at')::timestamptz 
      ELSE v_original_event.reminder_at 
    END,
    COALESCE((p_event_data->>'email_reminder_enabled')::boolean, v_original_event.email_reminder_enabled),
    COALESCE(p_event_data->>'language', v_original_event.language, 'en'),
    p_edited_by_type,
    p_edited_by_name,
    p_edited_by_type,
    p_edited_by_name,
    NOW(),
    NOW()
  ) RETURNING id INTO v_new_event_id;

  -- Step 3: Add additional persons to the new standalone event
  IF jsonb_array_length(p_additional_persons) > 0 THEN
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
      v_new_event_id,
      'customer',
      -- Use the new event's final dates for customers
      CASE 
        WHEN p_event_data->>'start_date' IS NOT NULL AND p_event_data->>'start_date' != v_instance_start_date::text
        THEN (p_event_data->>'start_date')::timestamptz 
        ELSE v_instance_start_date
      END,
      CASE 
        WHEN p_event_data->>'end_date' IS NOT NULL AND p_event_data->>'end_date' != v_instance_end_date::text
        THEN (p_event_data->>'end_date')::timestamptz 
        ELSE v_instance_end_date
      END,
      p_edited_by_type,
      p_edited_by_name,
      p_edited_by_type,
      p_edited_by_name
    FROM jsonb_array_elements(p_additional_persons) AS person;
  END IF;

  RAISE NOTICE '✅ Single instance edit complete: excluded_id=%, new_standalone_id=%, preserved_dates=%-%', 
               v_event_to_exclude, v_new_event_id, v_instance_start_date, v_instance_end_date;

  RETURN jsonb_build_object(
    'success', true,
    'excluded_event_id', v_event_to_exclude, 
    'new_event_id', v_new_event_id,
    'parent_event_id', v_parent_event_id,
    'instance_start_date', v_instance_start_date,
    'instance_end_date', v_instance_end_date
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error creating standalone event instance: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$