-- Fix the ultimate plan user that was incorrectly marked as expired
UPDATE subscriptions 
SET status = 'active',
    updated_at = NOW()
WHERE plan_type = 'ultimate' 
  AND status = 'expired';