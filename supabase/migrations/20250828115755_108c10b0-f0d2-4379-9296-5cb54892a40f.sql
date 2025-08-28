-- Enable RLS on tables that have policies but RLS is disabled (fix version)

-- Enable RLS on all tables that have policies but RLS disabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies for subscription_plans (read-only for all)
DROP POLICY IF EXISTS "Public can view subscription plans" ON public.subscription_plans;
CREATE POLICY "Public can view subscription plans"
ON public.subscription_plans
FOR SELECT
USING (true);

-- Add RLS policies for subscriptions
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can manage their own subscriptions"
ON public.subscriptions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add RLS policies for sub_users (drop existing first)
DROP POLICY IF EXISTS "Board owners can manage their sub-users" ON public.sub_users;
CREATE POLICY "Board owners can manage their sub-users"
ON public.sub_users
FOR ALL
USING (auth.uid() = board_owner_id)
WITH CHECK (auth.uid() = board_owner_id);