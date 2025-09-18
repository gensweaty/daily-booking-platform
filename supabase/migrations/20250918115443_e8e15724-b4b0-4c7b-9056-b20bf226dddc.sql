-- Fix customer data loss during event updates
-- The issue is that useCalendarEvents.updateEventMutation passes empty p_additional_persons array
-- This fixes it by preserving existing customer data when updating events

-- First, let's create a helper function to get existing customers for an event
CREATE OR REPLACE FUNCTION public.get_event_customers(p_event_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_customers jsonb;
  v_is_recurring boolean;
  v_parent_event_id uuid;
  v_actual_event_id uuid;
BEGIN
  -- Determine the actual event ID to query customers from
  SELECT is_recurring, parent_event_id INTO v_is_recurring, v_parent_event_id
  FROM events 
  WHERE id = p_event_id AND user_id = p_user_id;
  
  -- For recurring events, get customers from the parent event
  IF v_is_recurring = true THEN
    v_actual_event_id := p_event_id; -- This is the parent
  ELSIF v_parent_event_id IS NOT NULL THEN
    v_actual_event_id := v_parent_event_id; -- This is a child, use parent
  ELSE
    v_actual_event_id := p_event_id; -- Regular single event
  END IF;
  
  -- Get existing customers and format them as expected by save_event_with_persons
  SELECT jsonb_agg(
    jsonb_build_object(
      'userSurname', COALESCE(user_surname, title, ''),
      'userNumber', COALESCE(user_number, ''),
      'socialNetworkLink', COALESCE(social_network_link, ''),
      'eventNotes', COALESCE(event_notes, ''),
      'paymentStatus', COALESCE(payment_status, ''),
      'paymentAmount', COALESCE(payment_amount::text, '')
    )
  ) INTO v_customers
  FROM customers 
  WHERE event_id = v_actual_event_id 
    AND user_id = p_user_id 
    AND type = 'customer' 
    AND deleted_at IS NULL;
  
  -- Return empty array if no customers found
  RETURN COALESCE(v_customers, '[]'::jsonb);
END;
$function$;