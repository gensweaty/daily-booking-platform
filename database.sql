
-- Update the save_event_with_persons function to handle reminder fields
CREATE OR REPLACE FUNCTION public.save_event_with_persons(
  p_event_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_user_surname text DEFAULT NULL,
  p_user_number text DEFAULT NULL,
  p_social_network_link text DEFAULT NULL,
  p_event_notes text DEFAULT NULL,
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL,
  p_payment_status text DEFAULT 'not_paid',
  p_payment_amount numeric DEFAULT NULL,
  p_language text DEFAULT 'en',
  p_additional_persons jsonb DEFAULT '[]'::jsonb,
  p_recurring_pattern text DEFAULT NULL,
  p_recurring_until date DEFAULT NULL,
  p_reminder_at timestamp with time zone DEFAULT NULL,
  p_email_reminder_enabled boolean DEFAULT false
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
  
  IF p_title IS NULL OR p_title = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;
  
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'Start date and end date are required';
  END IF;
  
  -- Validate reminder time if enabled
  IF p_email_reminder_enabled AND (p_reminder_at IS NULL OR p_reminder_at >= p_start_date) THEN
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
    recurring_pattern,
    recurring_until,
    reminder_at,
    email_reminder_enabled
  ) VALUES (
    COALESCE(p_event_id, gen_random_uuid()),
    p_user_id,
    p_title,
    p_user_surname,
    p_user_number,
    p_social_network_link,
    p_event_notes,
    p_start_date,
    p_end_date,
    p_payment_status,
    p_payment_amount,
    p_language,
    p_recurring_pattern,
    p_recurring_until,
    p_reminder_at,
    p_email_reminder_enabled
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
    recurring_pattern = EXCLUDED.recurring_pattern,
    recurring_until = EXCLUDED.recurring_until,
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
        p_title,
        v_person->>'userSurname',
        v_person->>'userNumber',
        v_person->>'socialNetworkLink',
        v_person->>'eventNotes',
        p_start_date,
        p_end_date,
        COALESCE(v_person->>'paymentStatus', 'not_paid'),
        CASE 
          WHEN v_person->>'paymentAmount' IS NOT NULL AND v_person->>'paymentAmount' != '' 
          THEN (v_person->>'paymentAmount')::numeric 
          ELSE NULL 
        END,
        p_language,
        v_event_id,
        p_reminder_at,
        p_email_reminder_enabled
      );
    END LOOP;
  END IF;

  RETURN v_event_id;
END;
$function$;
