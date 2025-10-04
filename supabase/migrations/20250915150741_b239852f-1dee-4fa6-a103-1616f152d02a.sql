-- Debug and fix RLS policy for customers table to properly handle public board access

-- First, let's check the current policy and improve it
DROP POLICY IF EXISTS "Users can manage customers for their events" ON customers;

-- Create a better RLS policy that clearly handles both authenticated and public board access
CREATE POLICY "Enhanced customers access policy" ON customers
FOR ALL
USING (
  -- For authenticated users: they can access their own customers
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR
  -- For public board access: customers whose user_id belongs to an active public board
  (user_id IN (
    SELECT pb.user_id 
    FROM public_boards pb 
    WHERE pb.is_active = true
  ))
  OR
  -- For customers linked to events that belong to authenticated user
  (auth.uid() IS NOT NULL AND event_id IN (
    SELECT e.id 
    FROM events e 
    WHERE e.user_id = auth.uid()
  ))
  OR
  -- For customers linked to events that belong to active public boards
  (event_id IN (
    SELECT e.id 
    FROM events e 
    JOIN public_boards pb ON e.user_id = pb.user_id
    WHERE pb.is_active = true
  ))
)
WITH CHECK (
  -- For inserts: authenticated users can insert their own customers
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR
  -- For inserts: allow insertion for active public boards
  (auth.uid() IS NULL AND user_id IN (
    SELECT pb.user_id 
    FROM public_boards pb 
    WHERE pb.is_active = true
  ))
);

-- Add some helpful logging to debug the issue
CREATE OR REPLACE FUNCTION debug_customers_access(p_event_id uuid, p_user_id uuid)
RETURNS TABLE(
  customer_count bigint,
  event_exists boolean,
  public_board_active boolean,
  user_matches boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM customers WHERE event_id = p_event_id AND type = 'customer' AND deleted_at IS NULL),
    (SELECT EXISTS(SELECT 1 FROM events WHERE id = p_event_id)),
    (SELECT EXISTS(SELECT 1 FROM public_boards WHERE user_id = p_user_id AND is_active = true)),
    (SELECT EXISTS(SELECT 1 FROM events WHERE id = p_event_id AND user_id = p_user_id));
END;
$$;