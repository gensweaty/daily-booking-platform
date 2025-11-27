-- Fix ultimate subscription status issue
-- Update all ultimate plan subscriptions that have wrong status to 'active'
UPDATE subscriptions 
SET 
  status = 'active',
  updated_at = now()
WHERE 
  plan_type = 'ultimate' 
  AND status != 'active';

-- Create or replace function to automatically set ultimate subscriptions to active
CREATE OR REPLACE FUNCTION ensure_ultimate_subscription_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If this is an ultimate subscription, ensure status is always 'active'
  IF NEW.plan_type = 'ultimate' THEN
    NEW.status = 'active';
    -- Ensure no end dates for ultimate plans
    NEW.subscription_end_date = NULL;
    NEW.current_period_end = NULL;
    NEW.trial_end_date = NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS ensure_ultimate_status_trigger ON subscriptions;

CREATE TRIGGER ensure_ultimate_status_trigger
  BEFORE INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION ensure_ultimate_subscription_active();