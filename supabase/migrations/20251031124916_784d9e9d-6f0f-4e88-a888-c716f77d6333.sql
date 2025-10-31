-- Add trial_expired to allowed subscription statuses
-- This fixes the constraint violation error when trials expire

ALTER TABLE subscriptions 
DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE subscriptions 
ADD CONSTRAINT subscriptions_status_check 
CHECK (status IN ('trial', 'active', 'expired', 'pending', 'trial_expired'));