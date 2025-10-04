
-- Phase 1: Improve Data Structure & Relationships
-- Add event_id column to customers table to create proper relationship
ALTER TABLE customers ADD COLUMN IF NOT EXISTS event_id UUID;

-- Add foreign key constraint to link customers to events
ALTER TABLE customers ADD CONSTRAINT fk_customers_event_id 
FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_customers_event_id ON customers(event_id);

-- Create database function to handle multiple persons operations atomically
CREATE OR REPLACE FUNCTION save_event_with_persons(
  p_event_data JSONB,
  p_additional_persons JSONB,
  p_user_id UUID,
  p_event_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
  v_person JSONB;
BEGIN
  -- Insert or update the main event
  IF p_event_id IS NULL THEN
    -- Create new event
    INSERT INTO events (
      title, user_surname, user_number, social_network_link, event_notes,
      event_name, start_date, end_date, payment_status, payment_amount,
      user_id, type, is_recurring, repeat_pattern, repeat_until
    ) VALUES (
      p_event_data->>'title',
      p_event_data->>'user_surname', 
      p_event_data->>'user_number',
      p_event_data->>'social_network_link',
      p_event_data->>'event_notes',
      p_event_data->>'event_name',
      (p_event_data->>'start_date')::timestamptz,
      (p_event_data->>'end_date')::timestamptz,
      p_event_data->>'payment_status',
      CASE WHEN p_event_data->>'payment_amount' = '' THEN NULL 
           ELSE (p_event_data->>'payment_amount')::numeric END,
      p_user_id,
      COALESCE(p_event_data->>'type', 'event'),
      COALESCE((p_event_data->>'is_recurring')::boolean, false),
      p_event_data->>'repeat_pattern',
      CASE WHEN p_event_data->>'repeat_until' IS NOT NULL 
           THEN (p_event_data->>'repeat_until')::timestamptz 
           ELSE NULL END
    ) RETURNING id INTO v_event_id;
  ELSE
    -- Update existing event
    UPDATE events SET
      title = p_event_data->>'title',
      user_surname = p_event_data->>'user_surname',
      user_number = p_event_data->>'user_number', 
      social_network_link = p_event_data->>'social_network_link',
      event_notes = p_event_data->>'event_notes',
      event_name = p_event_data->>'event_name',
      start_date = (p_event_data->>'start_date')::timestamptz,
      end_date = (p_event_data->>'end_date')::timestamptz,
      payment_status = p_event_data->>'payment_status',
      payment_amount = CASE WHEN p_event_data->>'payment_amount' = '' THEN NULL 
                           ELSE (p_event_data->>'payment_amount')::numeric END,
      is_recurring = COALESCE((p_event_data->>'is_recurring')::boolean, false),
      repeat_pattern = p_event_data->>'repeat_pattern',
      repeat_until = CASE WHEN p_event_data->>'repeat_until' IS NOT NULL 
                         THEN (p_event_data->>'repeat_until')::timestamptz 
                         ELSE NULL END
    WHERE id = p_event_id AND user_id = p_user_id;
    
    v_event_id := p_event_id;
    
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
      v_person->>'userSurname',
      v_person->>'userSurname',
      v_person->>'userNumber',
      v_person->>'socialNetworkLink', 
      v_person->>'eventNotes',
      v_person->>'paymentStatus',
      CASE WHEN v_person->>'paymentAmount' = '' THEN NULL 
           ELSE (v_person->>'paymentAmount')::numeric END,
      p_user_id,
      v_event_id,
      'customer',
      (p_event_data->>'start_date')::timestamptz,
      (p_event_data->>'end_date')::timestamptz
    );
  END LOOP;

  RETURN v_event_id;
END;
$$;
