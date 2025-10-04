-- Enable RLS on critical tables that have policies but RLS disabled

-- Enable RLS on tables that already have policies but RLS is disabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Stripe cusotmers" ENABLE ROW LEVEL SECURITY;