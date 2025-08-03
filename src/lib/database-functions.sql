
-- Update the save_event_with_persons function to handle reminder fields properly
CREATE OR REPLACE FUNCTION public.save_event_with_persons(p_event_data jsonb, p_additional_persons jsonb, p_user_id uuid, p_event_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_event_id UUID;
  v_person JSONB;
  v_safe_title TEXT;
  v_safe_user_surname TEXT;
  v_is_recurring BOOLEAN;
  v_repeat_pattern TEXT;
  v_repeat_until DATE;
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_reminder_at TIMESTAMPTZ;
  v_email_reminder_enabled BOOLEAN;
  v_instances_created INTEGER := 0;
BEGIN
  -- Extract and validate recurring parameters
  v_is_recurring := COALESCE((p_event_data->>'is_recurring')::boolean, false);
  v_repeat_pattern := NULLIF(trim(p_event_data->>'repeat_pattern'), '');
  
  -- Parse repeat_until date safely
  BEGIN
    v_repeat_until := CASE 
      WHEN p_event_data->>'repeat_until' IS NOT NULL AND 
           trim(p_event_data->>'repeat_until') != '' AND
           trim(p_event_data->>'repeat_until') != 'null'
      THEN (trim(p_event_data->>'repeat_until'))::date 
      ELSE NULL 
    END;
  EXCEPTION WHEN OTHERS THEN
    v_repeat_until := NULL;
  END;
  
  -- Parse dates and reminder fields
  v_start_date := (p_event_data->>'start_date')::timestamptz;
  v_end_date := (p_event_data->>'end_date')::timestamptz;
  
  -- Parse reminder fields safely
  BEGIN
    v_reminder_at := CASE 
      WHEN p_event_data->>'reminder_at' IS NOT NULL AND 
           trim(p_event_data->>'reminder_at') != '' AND
           trim(p_event_data->>'reminder_at') != 'null'
      THEN (p_event_data->>'reminder_at')::timestamptz
      ELSE NULL
    END;
  EXCEPTION WHEN OTHERS THEN
    v_reminder_at := NULL;
  END;
  
  v_email_reminder_enabled := COALESCE((p_event_data->>'email_reminder_enabled')::boolean, false);

  -- Enhanced debug logging
  RAISE NOTICE '🔍 Event data received: is_recurring=%, repeat_pattern=%, repeat_until=%, start_date=%, reminder_at=%, email_reminder_enabled=%', 
               v_is_recurring, v_repeat_pattern, v_repeat_until, v_start_date::date, v_reminder_at, v_email_reminder_enabled;

  -- Validate recurring event parameters
  IF v_is_recurring = true THEN
    IF v_repeat_pattern IS NULL OR 
       v_repeat_pattern NOT IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly') OR
       v_repeat_until IS NULL OR
       v_repeat_until <= v_start_date::date THEN
      
      RAISE NOTICE '❌ Invalid recurring parameters, creating single event instead. Pattern: %, Until: %, Start: %', 
                   v_repeat_pattern, v_repeat_until, v_start_date::date;
      
      v_is_recurring := false;
      v_repeat_pattern := NULL;
      v_repeat_until := NULL;
    ELSE
      RAISE NOTICE '✅ Recurring event validation passed. Pattern: %, Until: %', 
                   v_repeat_pattern, v_repeat_until;
    END IF;
  END IF;

  -- Ensure we have safe values for title and user_surname
  v_safe_title := COALESCE(
    NULLIF(trim(p_event_data->>'title'), ''), 
    NULLIF(trim(p_event_data->>'user_surname'), ''), 
    'Untitled Event'
  );
  
  v_safe_user_surname := COALESCE(
    NULLIF(trim(p_event_data->>'user_surname'), ''), 
    NULLIF(trim(p_event_data->>'title'), ''), 
    'Unknown'
  );

  -- Insert or update the main event
  IF p_event_id IS NULL THEN
    -- Create new event
    INSERT INTO events (
      title, user_surname, user_number, social_network_link, event_notes,
      event_name, start_date, end_date, payment_status, payment_amount,
      user_id, type, is_recurring, repeat_pattern, repeat_until, 
      reminder_at, email_reminder_enabled,
      created_at, updated_at
    ) VALUES (
      v_safe_title,
      v_safe_user_surname,
      p_event_data->>'user_number',
      p_event_data->>'social_network_link',
      p_event_data->>'event_notes',
      p_event_data->>'event_name',
      v_start_date,
      v_end_date,
      p_event_data->>'payment_status',
      CASE WHEN p_event_data->>'payment_amount' = '' THEN NULL 
           ELSE (p_event_data->>'payment_amount')::numeric END,
      p_user_id,
      COALESCE(p_event_data->>'type', 'event'),
      v_is_recurring,
      v_repeat_pattern,
      v_repeat_until,
      v_reminder_at,
      v_email_reminder_enabled,
      NOW(),
      NOW()
    ) RETURNING id INTO v_event_id;
    
    RAISE NOTICE '📝 Created parent event: % with recurring: %, pattern: %, until: %, reminder: %, email_reminder: %', 
                 v_event_id, v_is_recurring, v_repeat_pattern, v_repeat_until, v_reminder_at, v_email_reminder_enabled;
    
    -- ✅ FIX: Pass reminder fields to generate_recurring_events
    IF v_is_recurring = true AND 
       v_repeat_pattern IS NOT NULL AND 
       v_repeat_pattern IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly') AND
       v_repeat_until IS NOT NULL THEN

      SELECT public.generate_recurring_events(
        v_event_id,
        v_start_date,
        v_end_date,
        v_repeat_pattern,
        v_repeat_until,
        p_user_id,
        v_reminder_at,
        v_email_reminder_enabled
      ) INTO v_instances_created;
      
      RAISE NOTICE '✅ Generated % recurring instances for event %', v_instances_created, v_event_id;
    END IF;
    
  ELSE
    -- Update existing event
    UPDATE events SET
      title = v_safe_title,
      user_surname = v_safe_user_surname,
      user_number = p_event_data->>'user_number', 
      social_network_link = p_event_data->>'social_network_link',
      event_notes = p_event_data->>'event_notes',
      event_name = p_event_data->>'event_name',
      start_date = v_start_date,
      end_date = v_end_date,
      payment_status = p_event_data->>'payment_status',
      payment_amount = CASE WHEN p_event_data->>'payment_amount' = '' THEN NULL 
                           ELSE (p_event_data->>'payment_amount')::numeric END,
      is_recurring = v_is_recurring,
      repeat_pattern = v_repeat_pattern,
      repeat_until = v_repeat_until,
      reminder_at = v_reminder_at,
      email_reminder_enabled = v_email_reminder_enabled,
      updated_at = NOW()
    WHERE id = p_event_id AND user_id = p_user_id;
    
    v_event_id := p_event_id;
    
    RAISE NOTICE '📝 Updated event: % with reminder: %, email_reminder: %', 
                 v_event_id, v_reminder_at, v_email_reminder_enabled;
    
    -- Delete existing additional persons for this event
    DELETE FROM customers 
    WHERE event_id = v_event_id AND user_id = p_user_id;
  END IF;

  -- Insert additional persons
  FOR v_person IN SELECT * FROM jsonb_array_elements(p_additional_persons)
  LOOP
    INSERT INTO customers (
      title, user_surname, user_number, social_network_link, event_notes,
      payment_status, payment_amount, user_id, event_id, type,
      start_date, end_date
    ) VALUES (
      COALESCE(NULLIF(trim(v_person->>'userSurname'), ''), 'Unknown'),
      COALESCE(NULLIF(trim(v_person->>'userSurname'), ''), 'Unknown'),
      v_person->>'userNumber',
      v_person->>'socialNetworkLink', 
      v_person->>'eventNotes',
      v_person->>'paymentStatus',
      CASE WHEN v_person->>'paymentAmount' = '' THEN NULL 
           ELSE (v_person->>'paymentAmount')::numeric END,
      p_user_id,
      v_event_id,
      'customer',
      v_start_date,
      v_end_date
    );
  END LOOP;

  RETURN v_event_id;
END;
$function$;

-- ✅ FIX: Update generate_recurring_events to accept and set reminder fields
CREATE OR REPLACE FUNCTION public.generate_recurring_events(
  p_parent_event_id uuid, 
  p_start_date timestamp with time zone, 
  p_end_date timestamp with time zone, 
  p_repeat_pattern text, 
  p_repeat_until date, 
  p_user_id uuid,
  p_reminder_at timestamp with time zone DEFAULT NULL,
  p_email_reminder_enabled boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  v_current_start TIMESTAMPTZ := p_start_date;
  v_current_end TIMESTAMPTZ := p_end_date;
  v_counter INTEGER := 0;
  v_duration INTERVAL;
  v_max_iterations INTEGER := 1000; -- Safety limit
  v_reminder_duration INTERVAL;
  v_current_reminder_at TIMESTAMPTZ;
BEGIN
  v_duration := p_end_date - p_start_date;
  
  -- Calculate reminder offset if reminder is set
  IF p_reminder_at IS NOT NULL AND p_email_reminder_enabled THEN
    v_reminder_duration := p_reminder_at - p_start_date;
    RAISE NOTICE '⏰ Reminder duration calculated: %', v_reminder_duration;
  END IF;

  RAISE NOTICE '🔄 Starting recurring event generation: parent=%, pattern=%, until=%, duration=%, reminder_enabled=%', 
               p_parent_event_id, p_repeat_pattern, p_repeat_until, v_duration, p_email_reminder_enabled;

  LOOP
    -- Calculate next occurrence (INCREMENT FIRST, BEFORE INSERT)
    IF p_repeat_pattern = 'daily' THEN
      v_current_start := v_current_start + INTERVAL '1 day';
    ELSIF p_repeat_pattern = 'weekly' THEN
      v_current_start := v_current_start + INTERVAL '1 week';
    ELSIF p_repeat_pattern = 'biweekly' THEN
      v_current_start := v_current_start + INTERVAL '2 week';
    ELSIF p_repeat_pattern = 'monthly' THEN
      v_current_start := v_current_start + INTERVAL '1 month';
    ELSIF p_repeat_pattern = 'yearly' THEN
      v_current_start := v_current_start + INTERVAL '1 year';
    ELSE
      RAISE WARNING 'Invalid repeat pattern: %', p_repeat_pattern;
      EXIT;
    END IF;

    v_current_end := v_current_start + v_duration;
    
    -- ✅ FIX: Calculate reminder time for this instance
    IF p_reminder_at IS NOT NULL AND p_email_reminder_enabled THEN
      v_current_reminder_at := v_current_start + v_reminder_duration;
    ELSE
      v_current_reminder_at := NULL;
    END IF;

    -- Stop if we've passed the repeat_until date
    IF v_current_start::date > p_repeat_until THEN
      RAISE NOTICE '📅 Reached repeat_until date. Current start: %, repeat_until: %', 
                   v_current_start::date, p_repeat_until;
      EXIT;
    END IF;

    -- ✅ FIX: Insert child instance WITH reminder fields
    INSERT INTO events (
      title, user_surname, user_number, social_network_link, event_notes, event_name,
      start_date, end_date, payment_status, payment_amount,
      user_id, type, is_recurring, repeat_pattern, repeat_until, parent_event_id,
      reminder_at, email_reminder_enabled,
      created_at
    )
    SELECT
      title, user_surname, user_number, social_network_link, event_notes, event_name,
      v_current_start, v_current_end, payment_status, payment_amount,
      user_id, type, is_recurring, repeat_pattern, repeat_until, id,
      v_current_reminder_at, p_email_reminder_enabled,
      NOW()
    FROM events WHERE id = p_parent_event_id;

    v_counter := v_counter + 1;
    
    RAISE NOTICE '✅ Created recurring instance #% with start_date: %, reminder_at: %', 
                 v_counter, v_current_start, v_current_reminder_at;
    
    IF v_counter >= v_max_iterations THEN
      RAISE WARNING 'Reached max iterations in recurring event loop!';
      EXIT;
    END IF;
  END LOOP;

  RAISE NOTICE '🎯 Completed recurring event generation: created % instances with reminder settings', v_counter;
  RETURN v_counter;
END;
$function$;

-- ✅ FIX: Create the correct cron job to invoke event reminders every minute
DO $$
BEGIN
  -- First, try to unschedule any existing event reminder jobs
  BEGIN
    PERFORM cron.unschedule('send-event-reminders');
    RAISE NOTICE 'Successfully unscheduled existing event reminder job';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'pg_cron extension not available, cannot unschedule';
    WHEN others THEN
      RAISE NOTICE 'Could not unschedule existing job (may not exist): %', SQLERRM;
  END;

  -- Create the new cron job to call the event reminder function every minute
  BEGIN
    PERFORM cron.schedule(
      'send-event-reminders',
      '* * * * *', -- Every minute
      $$
      SELECT
        net.http_post(
          url:='https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-event-reminder-email',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0OTU5MTgsImV4cCI6MjA0OTA3MTkxOH0.tntt0C1AgzJN-x3XrmIKb4j9iow8m4DZq3imEhJt9-0"}'::jsonb,
          body:='{"trigger": "cron", "timestamp": "'||NOW()||'"}'::jsonb
        ) as request_id;
      $$
    );
    RAISE NOTICE 'Successfully created cron job for event reminders';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'pg_cron extension is not available. Please enable pg_cron extension in your Supabase dashboard under Database > Extensions.';
    WHEN others THEN
      RAISE NOTICE 'Error creating cron job: %', SQLERRM;
  END;
END $$;

-- ✅ FIX: Add a test function to manually trigger event reminders (for debugging)
CREATE OR REPLACE FUNCTION public.test_trigger_event_reminders()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result json;
BEGIN
  SELECT net.http_post(
    url:='https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-event-reminder-email',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0OTU5MTgsImV4cCI6MjA0OTA3MTkxOH0.tntt0C1AgzJN-x3XrmIKb4j9iow8m4DZq3imEhJt9-0"}'::jsonb,
    body:='{"trigger": "manual_test", "timestamp": "'||NOW()||'"}'::jsonb
  ) INTO v_result;
  
  RETURN v_result;
END;
$function$;
