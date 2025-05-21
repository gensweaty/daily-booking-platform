
-- Add stripe-specific fields to the subscriptions table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE public.subscriptions ADD COLUMN stripe_customer_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE public.subscriptions ADD COLUMN stripe_subscription_id TEXT;
  END IF;
END $$;

-- Create or replace a function to check trial and subscription status
CREATE OR REPLACE FUNCTION public.check_subscription_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update expired trials
  UPDATE subscriptions
  SET status = 'expired'
  WHERE status = 'trial'
    AND trial_end_date < CURRENT_TIMESTAMP;

  -- Update expired subscriptions
  UPDATE subscriptions
  SET status = 'expired'
  WHERE status = 'active'
    AND current_period_end IS NOT NULL
    AND current_period_end < CURRENT_TIMESTAMP;
END;
$$;

-- Create a trigger to periodically check subscription status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_cron_job
    WHERE command = 'SELECT public.check_subscription_status();'
  ) THEN
    SELECT cron.schedule('check-subscriptions', '0 * * * *', 'SELECT public.check_subscription_status();');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron may not be installed, you will need to set up a scheduled job manually';
END $$;
