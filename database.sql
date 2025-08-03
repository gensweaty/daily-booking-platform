
-- Update the save_event_with_persons function to handle reminder fields
CREATE OR REPLACE FUNCTION public.save_event_with_persons(
  p_event_data jsonb,
  p_additional_persons jsonb DEFAULT '[]'::jsonb,
  p_user_id uuid DEFAULT NULL,
  p_event_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_person jsonb;
  v_person_event_id uuid;
BEGIN
  -- Validate required parameters
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;
  
  IF p_event_data->>'title' IS NULL OR p_event_data->>'title' = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;
  
  IF p_event_data->>'start_date' IS NULL OR p_event_data->>'end_date' IS NULL THEN
    RAISE EXCEPTION 'Start date and end date are required';
  END IF;
  
  -- Validate reminder time if enabled
  IF (p_event_data->>'email_reminder_enabled')::boolean = true AND 
     (p_event_data->>'reminder_at' IS NULL OR 
      (p_event_data->>'reminder_at')::timestamptz >= (p_event_data->>'start_date')::timestamptz) THEN
    RAISE EXCEPTION 'Reminder time must be before event start time when reminder is enabled';
  END IF;

  -- Insert or update the main event
  INSERT INTO events (
    id,
    user_id,
    title,
    user_surname,
    user_number,
    social_network_link,
    event_notes,
    start_date,
    end_date,
    payment_status,
    payment_amount,
    language,
    is_recurring,
    repeat_pattern,
    repeat_until,
    reminder_at,
    email_reminder_enabled
  ) VALUES (
    COALESCE(p_event_id, gen_random_uuid()),
    p_user_id,
    p_event_data->>'title',
    p_event_data->>'user_surname',
    p_event_data->>'user_number',
    p_event_data->>'social_network_link',
    p_event_data->>'event_notes',
    (p_event_data->>'start_date')::timestamptz,
    (p_event_data->>'end_date')::timestamptz,
    p_event_data->>'payment_status',
    CASE WHEN p_event_data->>'payment_amount' = '' OR p_event_data->>'payment_amount' IS NULL 
         THEN NULL 
         ELSE (p_event_data->>'payment_amount')::numeric END,
    p_event_data->>'language',
    COALESCE((p_event_data->>'is_recurring')::boolean, false),
    p_event_data->>'repeat_pattern',
    CASE WHEN p_event_data->>'repeat_until' = '' OR p_event_data->>'repeat_until' IS NULL 
         THEN NULL 
         ELSE (p_event_data->>'repeat_until')::date END,
    CASE WHEN (p_event_data->>'email_reminder_enabled')::boolean = true 
         THEN (p_event_data->>'reminder_at')::timestamptz 
         ELSE NULL END,
    COALESCE((p_event_data->>'email_reminder_enabled')::boolean, false)
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    user_surname = EXCLUDED.user_surname,
    user_number = EXCLUDED.user_number,
    social_network_link = EXCLUDED.social_network_link,
    event_notes = EXCLUDED.event_notes,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    payment_status = EXCLUDED.payment_status,
    payment_amount = EXCLUDED.payment_amount,
    language = EXCLUDED.language,
    is_recurring = EXCLUDED.is_recurring,
    repeat_pattern = EXCLUDED.repeat_pattern,
    repeat_until = EXCLUDED.repeat_until,
    reminder_at = EXCLUDED.reminder_at,
    email_reminder_enabled = EXCLUDED.email_reminder_enabled,
    updated_at = CURRENT_TIMESTAMP
  RETURNING id INTO v_event_id;

  -- Handle additional persons if provided
  IF p_additional_persons IS NOT NULL AND jsonb_array_length(p_additional_persons) > 0 THEN
    -- Loop through each additional person
    FOR v_person IN SELECT * FROM jsonb_array_elements(p_additional_persons)
    LOOP
      -- Insert additional person as a separate event
      INSERT INTO events (
        user_id,
        title,
        user_surname,
        user_number,
        social_network_link,
        event_notes,
        start_date,
        end_date,
        payment_status,
        payment_amount,
        language,
        recurring_parent_id,
        reminder_at,
        email_reminder_enabled
      ) VALUES (
        p_user_id,
        p_event_data->>'title',
        v_person->>'userSurname',
        v_person->>'userNumber',
        v_person->>'socialNetworkLink',
        v_person->>'eventNotes',
        (p_event_data->>'start_date')::timestamptz,
        (p_event_data->>'end_date')::timestamptz,
        COALESCE(v_person->>'paymentStatus', 'not_paid'),
        CASE 
          WHEN v_person->>'paymentAmount' IS NOT NULL AND v_person->>'paymentAmount' != '' 
          THEN (v_person->>'paymentAmount')::numeric 
          ELSE NULL 
        END,
        p_event_data->>'language',
        v_event_id,
        CASE WHEN (p_event_data->>'email_reminder_enabled')::boolean = true 
             THEN (p_event_data->>'reminder_at')::timestamptz 
             ELSE NULL END,
        COALESCE((p_event_data->>'email_reminder_enabled')::boolean, false)
      );
    END LOOP;
  END IF;

  RETURN v_event_id;
END;
$function$;
