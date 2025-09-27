-- Critical fix: Enhance event series handling to prevent parent event date pollution
-- This fixes the issue where editing a virtual instance was causing the parent event to be rescheduled

-- Enhanced RPC function to properly handle virtual instance detection
CREATE OR REPLACE FUNCTION public.debug_event_context(
  p_event_id text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY definer
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_event record;
  v_parent_id text;
  v_is_virtual boolean := false;
BEGIN
  -- Check if this is a virtual instance ID (contains date component)
  v_is_virtual := p_event_id LIKE '%-%-%-%' AND length(p_event_id) > 36;
  
  -- Extract parent ID if virtual
  IF v_is_virtual THEN
    v_parent_id := split_part(p_event_id, '-', 1);
    
    -- Fetch parent event
    SELECT * INTO v_event
    FROM events
    WHERE id::text = v_parent_id AND user_id = p_user_id;
  ELSE
    -- Direct event lookup
    SELECT * INTO v_event
    FROM events
    WHERE id::text = p_event_id AND user_id = p_user_id;
    
    v_parent_id := p_event_id;
  END IF;
  
  -- Build debug result
  v_result := jsonb_build_object(
    'input_event_id', p_event_id,
    'is_virtual_instance', v_is_virtual,
    'resolved_parent_id', v_parent_id,
    'event_found', v_event IS NOT NULL,
    'event_data', CASE 
      WHEN v_event IS NOT NULL THEN jsonb_build_object(
        'id', v_event.id,
        'title', v_event.title,
        'is_recurring', v_event.is_recurring,
        'parent_event_id', v_event.parent_event_id,
        'start_date', v_event.start_date,
        'end_date', v_event.end_date
      )
      ELSE null
    END
  );
  
  RETURN v_result;
END;
$$;

-- Enhanced function to safely edit single instances without affecting parent
CREATE OR REPLACE FUNCTION public.edit_single_event_instance_v3(
  p_event_id text,
  p_user_id uuid,
  p_event_data jsonb,
  p_additional_persons jsonb[] DEFAULT '{}',
  p_instance_start text DEFAULT null,
  p_instance_end text DEFAULT null,
  p_edited_by_type text DEFAULT 'admin',
  p_edited_by_name text DEFAULT 'Admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY definer
SET search_path = public
AS $$
DECLARE
  v_parent_id text;
  v_is_virtual boolean := false;
  v_parent_event record;
  v_new_event_id text;
  v_instance_date text;
  v_debug_info jsonb;
BEGIN
  -- Debug the event context
  v_debug_info := public.debug_event_context(p_event_id, p_user_id);
  
  -- Extract info from debug result
  v_is_virtual := (v_debug_info->>'is_virtual_instance')::boolean;
  v_parent_id := v_debug_info->>'resolved_parent_id';
  
  -- Verify parent event exists and user has access
  SELECT * INTO v_parent_event
  FROM events
  WHERE id::text = v_parent_id 
  AND user_id = p_user_id
  AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Parent event not found or access denied',
      'debug_info', v_debug_info
    );
  END IF;
  
  -- Generate new UUID for standalone event
  v_new_event_id := gen_random_uuid();
  
  -- Extract instance date if this is a virtual instance
  IF v_is_virtual THEN
    v_instance_date := split_part(p_event_id, '-', 4);
  END IF;
  
  -- Create standalone event from the series with new dates
  INSERT INTO events (
    id, user_id, title, user_surname, user_number, social_network_link,
    event_notes, event_name, start_date, end_date, payment_status, payment_amount,
    type, is_recurring, repeat_pattern, repeat_until,
    reminder_at, email_reminder_enabled, language,
    created_by_type, created_by_name, last_edited_by_type, last_edited_by_name,
    created_at, updated_at
  ) VALUES (
    v_new_event_id::uuid,
    p_user_id,
    COALESCE((p_event_data->>'title'), (p_event_data->>'user_surname'), v_parent_event.title),
    COALESCE((p_event_data->>'user_surname'), v_parent_event.user_surname),
    COALESCE((p_event_data->>'user_number'), v_parent_event.user_number),
    COALESCE((p_event_data->>'social_network_link'), v_parent_event.social_network_link),
    COALESCE((p_event_data->>'event_notes'), v_parent_event.event_notes),
    COALESCE((p_event_data->>'event_name'), v_parent_event.event_name),
    -- Use the provided instance dates, not parent dates
    COALESCE(p_instance_start::timestamp with time zone, (p_event_data->>'start_date')::timestamp with time zone, v_parent_event.start_date),
    COALESCE(p_instance_end::timestamp with time zone, (p_event_data->>'end_date')::timestamp with time zone, v_parent_event.end_date),
    COALESCE((p_event_data->>'payment_status'), v_parent_event.payment_status, 'not_paid'),
    CASE 
      WHEN (p_event_data->>'payment_amount') IS NOT NULL THEN (p_event_data->>'payment_amount')::decimal
      ELSE v_parent_event.payment_amount
    END,
    COALESCE((p_event_data->>'type'), v_parent_event.type, 'event'),
    -- New standalone events are not recurring
    false,
    null,
    null,
    CASE 
      WHEN (p_event_data->>'reminder_at') IS NOT NULL THEN (p_event_data->>'reminder_at')::timestamp with time zone
      ELSE null
    END,
    COALESCE((p_event_data->>'email_reminder_enabled')::boolean, false),
    COALESCE((p_event_data->>'language'), v_parent_event.language, 'en'),
    p_edited_by_type,
    p_edited_by_name,
    p_edited_by_type,
    p_edited_by_name,
    now(),
    now()
  );
  
  -- Add the instance to exclusions so it doesn't appear in the original series
  IF v_is_virtual AND v_instance_date IS NOT NULL THEN
    INSERT INTO recurring_event_exclusions (
      parent_event_id,
      excluded_date,
      reason,
      created_at
    ) VALUES (
      v_parent_id::uuid,
      v_instance_date::date,
      'Edited as standalone event',
      now()
    )
    ON CONFLICT (parent_event_id, excluded_date) DO NOTHING;
  END IF;
  
  -- Handle additional persons if provided
  IF array_length(p_additional_persons, 1) > 0 THEN
    INSERT INTO customers (
      id, event_id, user_id, title, user_surname, user_number,
      social_network_link, event_notes, payment_status, payment_amount,
      type, created_at, updated_at
    )
    SELECT 
      gen_random_uuid(),
      v_new_event_id::uuid,
      p_user_id,
      COALESCE(person->>'userSurname', ''),
      COALESCE(person->>'userSurname', ''),
      COALESCE(person->>'userNumber', ''),
      COALESCE(person->>'socialNetworkLink', ''),
      COALESCE(person->>'eventNotes', ''),
      COALESCE(person->>'paymentStatus', 'not_paid'),
      CASE 
        WHEN (person->>'paymentAmount') IS NOT NULL AND (person->>'paymentAmount') != '' 
        THEN (person->>'paymentAmount')::decimal
        ELSE null
      END,
      'customer',
      now(),
      now()
    FROM unnest(p_additional_persons) AS person;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'new_event_id', v_new_event_id,
    'parent_event_preserved', true,
    'debug_info', v_debug_info,
    'message', 'Single instance edited as standalone event'
  );
END;
$$;

-- Enhanced cleanup function to remove date conflicts
CREATE OR REPLACE FUNCTION public.cleanup_recurring_event_conflicts_v2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY definer
SET search_path = public
AS $$
DECLARE
  v_conflicts_found integer := 0;
  v_conflicts_resolved integer := 0;
  v_orphaned_events integer := 0;
BEGIN
  -- Log start
  RAISE NOTICE 'Starting recurring event conflict cleanup v2';
  
  -- Count initial conflicts (events with same dates in a series)
  SELECT COUNT(*) INTO v_conflicts_found
  FROM events e1
  JOIN events e2 ON e1.user_id = e2.user_id 
    AND e1.id != e2.id
    AND e1.start_date = e2.start_date
    AND e1.end_date = e2.end_date
  WHERE (e1.is_recurring = true OR e2.is_recurring = true OR 
         e1.parent_event_id IS NOT NULL OR e2.parent_event_id IS NOT NULL)
  AND e1.deleted_at IS NULL AND e2.deleted_at IS NULL;
  
  -- Soft delete orphaned recurring instances that lost their parent
  UPDATE events 
  SET deleted_at = now(),
      updated_at = now()
  WHERE parent_event_id IS NOT NULL 
  AND parent_event_id NOT IN (
    SELECT id FROM events WHERE deleted_at IS NULL
  )
  AND deleted_at IS NULL;
  
  GET DIAGNOSTICS v_orphaned_events = ROW_COUNT;
  
  -- Clean up duplicate time slots within series (keep the parent, remove duplicates)
  WITH duplicate_instances AS (
    SELECT e1.id as duplicate_id
    FROM events e1
    JOIN events e2 ON e1.user_id = e2.user_id 
      AND e1.id != e2.id
      AND e1.start_date = e2.start_date
      AND e1.end_date = e2.end_date
    WHERE e2.is_recurring = true  -- e2 is the parent
    AND e1.parent_event_id = e2.id  -- e1 is a child of e2
    AND e1.deleted_at IS NULL 
    AND e2.deleted_at IS NULL
  )
  UPDATE events 
  SET deleted_at = now(),
      updated_at = now()
  WHERE id IN (SELECT duplicate_id FROM duplicate_instances);
  
  GET DIAGNOSTICS v_conflicts_resolved = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'conflicts_found', v_conflicts_found,
    'conflicts_resolved', v_conflicts_resolved,
    'orphaned_events_cleaned', v_orphaned_events,
    'cleanup_completed_at', now()
  );
END;
$$;

-- Run the cleanup immediately
SELECT public.cleanup_recurring_event_conflicts_v2();