-- 1. Update the RPC to prevent parent event date changes during series updates
CREATE OR REPLACE FUNCTION public.update_event_series_safe(
  p_event_id uuid,
  p_user_id uuid,
  p_event_data jsonb DEFAULT '{}'::jsonb,
  p_additional_persons jsonb DEFAULT '[]'::jsonb,
  p_edited_by_type text DEFAULT 'admin'::text,
  p_edited_by_name text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_row          events%ROWTYPE;
  v_root_id      uuid;
  v_updated_count integer := 0;
BEGIN
  SELECT * INTO v_row
  FROM events
  WHERE id = p_event_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Always operate on the series root
  v_root_id := COALESCE(v_row.parent_event_id, v_row.id);

  -- CRITICAL FIX: Update parent + all non-excluded children, but NEVER change dates/recurrence/reminders
  -- This prevents the parent from being rescheduled to instance dates, eliminating duplicates
  UPDATE events e
     SET title                   = COALESCE(p_event_data->>'title', e.title),
         user_surname            = COALESCE(p_event_data->>'user_surname', e.user_surname),
         user_number             = COALESCE(p_event_data->>'user_number', e.user_number),
         social_network_link     = COALESCE(p_event_data->>'social_network_link', e.social_network_link),
         event_notes             = COALESCE(p_event_data->>'event_notes', e.event_notes),
         event_name              = COALESCE(p_event_data->>'event_name', e.event_name),
         payment_status          = COALESCE(p_event_data->>'payment_status', e.payment_status),
         payment_amount          = COALESCE(NULLIF(p_event_data->>'payment_amount','')::numeric, e.payment_amount),
         -- EXCLUDED FIELDS: start_date, end_date, is_recurring, repeat_pattern, repeat_until, reminder_at, email_reminder_enabled
         -- These are intentionally NOT updated to prevent parent from jumping to instance dates
         last_edited_by_type     = p_edited_by_type,
         last_edited_by_name     = p_edited_by_name,
         updated_at              = NOW()
   WHERE (e.id = v_root_id OR e.parent_event_id = v_root_id)
     AND COALESCE(e.excluded_from_series, FALSE) = FALSE
     AND e.user_id = p_user_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Update customers for all events in the series
  -- First delete existing customers for all events in the series
  DELETE FROM customers 
  WHERE event_id IN (
    SELECT id FROM events 
    WHERE (id = v_root_id OR parent_event_id = v_root_id)
      AND COALESCE(excluded_from_series, FALSE) = FALSE
      AND user_id = p_user_id
  )
  AND user_id = p_user_id 
  AND type = 'customer';

  -- Then insert new customers for all events in the series if provided
  IF COALESCE(jsonb_array_length(p_additional_persons), 0) > 0 THEN
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
      e.id,
      'customer',
      e.start_date,
      e.end_date,
      p_edited_by_type,
      p_edited_by_name,
      p_edited_by_type,
      p_edited_by_name
    FROM jsonb_array_elements(p_additional_persons) AS person
    CROSS JOIN (
      SELECT id, start_date, end_date FROM events 
      WHERE (id = v_root_id OR parent_event_id = v_root_id)
        AND COALESCE(excluded_from_series, FALSE) = FALSE
        AND user_id = p_user_id
    ) e;
  END IF;

  RAISE NOTICE '✅ Safe series update complete: updated % events, root_id=%, NO dates changed', 
               v_updated_count, v_root_id;

  RETURN jsonb_build_object('success', true, 'updated_count', v_updated_count, 'root_event_id', v_root_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- 2. Create a cleanup function to detect and resolve existing parent/child date conflicts
CREATE OR REPLACE FUNCTION public.cleanup_recurring_event_conflicts(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_conflicts_found integer := 0;
  v_conflicts_resolved integer := 0;
  v_conflict_record RECORD;
BEGIN
  -- Find parent events that have the same start_date as any of their children
  FOR v_conflict_record IN
    SELECT DISTINCT 
      parent.id as parent_id,
      parent.start_date as parent_start,
      parent.title as parent_title,
      child.id as child_id,
      child.start_date as child_start,
      parent.user_id
    FROM events parent
    JOIN events child ON child.parent_event_id = parent.id
    WHERE parent.is_recurring = true
      AND parent.start_date = child.start_date
      AND parent.deleted_at IS NULL
      AND child.deleted_at IS NULL
      AND (p_user_id IS NULL OR parent.user_id = p_user_id)
  LOOP
    v_conflicts_found := v_conflicts_found + 1;
    
    RAISE NOTICE 'Found conflict: parent % ("%") and child % both at %', 
                 v_conflict_record.parent_id, 
                 v_conflict_record.parent_title, 
                 v_conflict_record.child_id,
                 v_conflict_record.parent_start;
    
    -- Strategy: Mark the conflicting child as excluded from series
    -- This preserves both events but eliminates the visual duplicate
    UPDATE events 
    SET excluded_from_series = TRUE,
        updated_at = NOW()
    WHERE id = v_conflict_record.child_id;
    
    v_conflicts_resolved := v_conflicts_resolved + 1;
  END LOOP;

  RAISE NOTICE '🔧 Cleanup complete: found % conflicts, resolved %', 
               v_conflicts_found, v_conflicts_resolved;

  RETURN jsonb_build_object(
    'success', true, 
    'conflicts_found', v_conflicts_found,
    'conflicts_resolved', v_conflicts_resolved,
    'message', format('Found %s conflicts and resolved %s by excluding conflicting children', v_conflicts_found, v_conflicts_resolved)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;