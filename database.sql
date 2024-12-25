-- Create a function to handle subscription creation with proper authentication
CREATE OR REPLACE FUNCTION create_subscription(
  p_user_id UUID,
  p_plan_id UUID,
  p_plan_type VARCHAR,
  p_trial_end_date TIMESTAMPTZ,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO subscriptions (
    user_id,
    plan_id,
    plan_type,
    status,
    trial_end_date,
    current_period_start,
    current_period_end
  ) VALUES (
    p_user_id,
    p_plan_id,
    p_plan_type,
    'trial',
    p_trial_end_date,
    p_current_period_start,
    p_current_period_end
  );
END;
$$;

-- Add RLS policies for subscription_plans if not already present
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'subscription_plans'
        AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users"
        ON subscription_plans FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END
$$;