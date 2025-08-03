-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Create or replace the save_event_with_persons function
CREATE OR REPLACE FUNCTION public.save_event_with_persons(
  p_event_data jsonb,
  p_additional_persons jsonb DEFAULT '[]'::jsonb,
  p_user_id uuid DEFAULT NULL,
  p_event_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
  v_person jsonb;
  v_customer_id uuid;
BEGIN
  -- If event_id is provided, update existing event
  IF p_event_id IS NOT NULL THEN
    UPDATE events SET
      title = COALESCE((p_event_data->>'title')::text, title),
      user_surname = COALESCE((p_event_data->>'user_surname')::text, user_surname),
      user_number = COALESCE((p_event_data->>'user_number')::text, user_number),
      social_network_link = COALESCE((p_event_data->>'social_network_link')::text, social_network_link),
      event_notes = COALESCE((p_event_data->>'event_notes')::text, event_notes),
      start_date = COALESCE((p_event_data->>'start_date')::timestamptz, start_date),
      end_date = COALESCE((p_event_data->>'end_date')::timestamptz, end_date),
      payment_status = COALESCE((p_event_data->>'payment_status')::text, payment_status),
      payment_amount = CASE 
        WHEN p_event_data->>'payment_amount' IS NOT NULL 
        THEN (p_event_data->>'payment_amount')::numeric 
        ELSE payment_amount 
      END,
      language = COALESCE((p_event_data->>'language')::text, language),
      is_recurring = COALESCE((p_event_data->>'is_recurring')::boolean, is_recurring),
      repeat_pattern = COALESCE((p_event_data->>'repeat_pattern')::text, repeat_pattern),
      repeat_until = CASE 
        WHEN p_event_data->>'repeat_until' IS NOT NULL 
        THEN (p_event_data->>'repeat_until')::date 
        ELSE repeat_until 
      END,
      reminder_at = CASE 
        WHEN p_event_data->>'reminder_at' IS NOT NULL 
        THEN (p_event_data->>'reminder_at')::timestamptz 
        ELSE reminder_at 
      END,
      email_reminder_enabled = COALESCE((p_event_data->>'email_reminder_enabled')::boolean, email_reminder_enabled),
      updated_at = NOW()
    WHERE id = p_event_id AND user_id = p_user_id;
    
    v_event_id := p_event_id;
  ELSE
    -- Create new event
    INSERT INTO events (
      title, user_surname, user_number, social_network_link, event_notes,
      start_date, end_date, payment_status, payment_amount, user_id, language,
      is_recurring, repeat_pattern, repeat_until, reminder_at, email_reminder_enabled
    ) VALUES (
      (p_event_data->>'title')::text,
      (p_event_data->>'user_surname')::text,
      (p_event_data->>'user_number')::text,
      (p_event_data->>'social_network_link')::text,
      (p_event_data->>'event_notes')::text,
      (p_event_data->>'start_date')::timestamptz,
      (p_event_data->>'end_date')::timestamptz,
      COALESCE((p_event_data->>'payment_status')::text, 'not_paid'),
      CASE 
        WHEN p_event_data->>'payment_amount' IS NOT NULL 
        THEN (p_event_data->>'payment_amount')::numeric 
        ELSE NULL 
      END,
      p_user_id,
      (p_event_data->>'language')::text,
      COALESCE((p_event_data->>'is_recurring')::boolean, false),
      (p_event_data->>'repeat_pattern')::text,
      CASE 
        WHEN p_event_data->>'repeat_until' IS NOT NULL 
        THEN (p_event_data->>'repeat_until')::date 
        ELSE NULL 
      END,
      CASE 
        WHEN p_event_data->>'reminder_at' IS NOT NULL 
        THEN (p_event_data->>'reminder_at')::timestamptz 
        ELSE NULL 
      END,
      COALESCE((p_event_data->>'email_reminder_enabled')::boolean, false)
    ) RETURNING id INTO v_event_id;
  END IF;

  -- Handle additional persons
  IF jsonb_array_length(p_additional_persons) > 0 THEN
    -- Delete existing additional persons for this event
    DELETE FROM customers WHERE event_id = v_event_id;
    
    -- Insert new additional persons
    FOR v_person IN SELECT * FROM jsonb_array_elements(p_additional_persons)
    LOOP
      INSERT INTO customers (
        event_id, user_surname, user_number, social_network_link,
        event_notes, payment_status, payment_amount, user_id
      ) VALUES (
        v_event_id,
        (v_person->>'userSurname')::text,
        (v_person->>'userNumber')::text,
        (v_person->>'socialNetworkLink')::text,
        (v_person->>'eventNotes')::text,
        COALESCE((v_person->>'paymentStatus')::text, 'not_paid'),
        CASE 
          WHEN v_person->>'paymentAmount' IS NOT NULL AND v_person->>'paymentAmount' != ''
          THEN (v_person->>'paymentAmount')::numeric 
          ELSE NULL 
        END,
        p_user_id
      );
    END LOOP;
  END IF;

  RETURN v_event_id;
END;
$$;

-- Create or replace function to delete events (soft delete)
CREATE OR REPLACE FUNCTION public.delete_event_safe(
  p_event_id uuid,
  p_user_id uuid,
  p_delete_choice text DEFAULT 'this'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Soft delete the event by setting deleted_at timestamp
  UPDATE events 
  SET deleted_at = NOW()
  WHERE id = p_event_id 
    AND user_id = p_user_id 
    AND deleted_at IS NULL;
  
  -- Also soft delete associated customers
  UPDATE customers 
  SET deleted_at = NOW()
  WHERE event_id = p_event_id 
    AND user_id = p_user_id 
    AND deleted_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Create or replace function to permanently delete events (for cleanup)
CREATE OR REPLACE FUNCTION public.cleanup_deleted_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer := 0;
BEGIN
  -- Delete events that have been soft-deleted for more than 30 days
  DELETE FROM events 
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Delete associated customers
  DELETE FROM customers 
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days';
  
  RETURN v_deleted_count;
END;
$$;

-- ✅ FIXED: Update the cron job with correct URL and authentication
SELECT cron.unschedule('send-event-reminders-every-2-minutes');

SELECT cron.schedule(
  'send-event-reminders-every-2-minutes',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-event-reminder-email',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzQ5NTkxOCwiZXhwIjoyMDQ5MDcxOTE4fQ.NzIyZjY0NjYyMGZjMGY3ZjhiMGY2ZGZmODVjOGJlZjg5ZWQyNzRmMWE0NmJhOWJmZDFhOGU0MTc0MDI4M2NhOQ"}'::jsonb,
    body := '{"manual_trigger": false}'::jsonb
  );
  $$
);

-- Add manual test function for debugging
CREATE OR REPLACE FUNCTION public.manual_trigger_event_reminders()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response json;
BEGIN
  -- Call the edge function directly
  SELECT net.http_post(
    url := 'https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-event-reminder-email',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ydWVxcGZmemF1dmR4bXV3aGZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzQ5NTkxOCwiZXhwIjoyMDQ5MDcxOTE4fQ.NzIyZjY0NjYyMGZjMGY3ZjhiMGY2ZGZmODVjOGJlZjg5ZWQyNzRmMWE0NmJhOWJmZDFhOGU0MTc0MDI4M2NhOQ"}'::jsonb,
    body := '{"manual_trigger": true}'::jsonb
  ) INTO v_response;
  
  RETURN v_response;
END;
$$;

-- Add function to check which events should get reminders
CREATE OR REPLACE FUNCTION public.debug_check_upcoming_reminders()
RETURNS TABLE(
  event_id UUID,
  event_title TEXT,
  event_start_date TIMESTAMPTZ,
  reminder_at TIMESTAMPTZ,
  email_reminder_enabled BOOLEAN,
  reminder_sent_at TIMESTAMPTZ,
  primary_email TEXT,
  time_until_reminder INTERVAL,
  is_due BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as event_id,
    e.title as event_title,
    e.start_date as event_start_date,
    e.reminder_at,
    e.email_reminder_enabled,
    e.reminder_sent_at,
    e.social_network_link as primary_email,
    (e.reminder_at - NOW()) as time_until_reminder,
    (e.reminder_at <= NOW() AND e.reminder_sent_at IS NULL AND e.email_reminder_enabled = true) as is_due
  FROM events e
  WHERE e.deleted_at IS NULL
    AND e.reminder_at IS NOT NULL
    AND e.email_reminder_enabled = true
  ORDER BY e.reminder_at ASC;
END;
$$;
