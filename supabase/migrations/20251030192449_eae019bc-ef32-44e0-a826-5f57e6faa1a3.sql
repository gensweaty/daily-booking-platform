-- Create push_subscriptions table for storing user push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  sub_user_id uuid REFERENCES sub_users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  keys jsonb NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now(),
  CONSTRAINT user_or_sub_user_check CHECK (
    (user_id IS NOT NULL AND sub_user_id IS NULL) OR
    (user_id IS NULL AND sub_user_id IS NOT NULL)
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_sub_user_id ON push_subscriptions(sub_user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own push subscriptions
CREATE POLICY "Users can manage their own push subscriptions"
ON push_subscriptions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Sub users can manage their push subscriptions through their board owner
CREATE POLICY "Sub users can manage push subscriptions"
ON push_subscriptions
FOR ALL
USING (
  sub_user_id IN (
    SELECT id FROM sub_users WHERE board_owner_id = auth.uid()
  )
)
WITH CHECK (
  sub_user_id IN (
    SELECT id FROM sub_users WHERE board_owner_id = auth.uid()
  )
);

-- Service role can access all subscriptions (for edge functions)
CREATE POLICY "Service role full access"
ON push_subscriptions
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');