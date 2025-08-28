-- Enable RLS on all public tables that need it
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Add missing RLS policies for subscription plans (read-only public access)
CREATE POLICY "Allow public read access to subscription plans" 
ON public.subscription_plans 
FOR SELECT 
TO authenticated, anon
USING (true);

-- Add missing RLS policies for sub_users
CREATE POLICY "Board owners can manage their sub-users" 
ON public.sub_users 
FOR ALL 
TO authenticated
USING (board_owner_id = auth.uid())
WITH CHECK (board_owner_id = auth.uid());

-- Add missing RLS policies for tasks (if missing)
CREATE POLICY "Users can manage their own tasks" 
ON public.tasks 
FOR ALL 
TO authenticated
USING (user_id = auth.uid() OR user_id IN (
  SELECT pb.user_id FROM public_boards pb WHERE pb.is_active = true
))
WITH CHECK (user_id = auth.uid());

-- Add missing RLS policies for task_comments
CREATE POLICY "Users can manage comments on their tasks" 
ON public.task_comments 
FOR ALL 
TO authenticated
USING (
  task_id IN (
    SELECT t.id FROM tasks t WHERE t.user_id = auth.uid()
  ) OR 
  task_id IN (
    SELECT t.id FROM tasks t 
    JOIN public_boards pb ON t.user_id = pb.user_id 
    WHERE pb.is_active = true
  )
)
WITH CHECK (
  task_id IN (
    SELECT t.id FROM tasks t WHERE t.user_id = auth.uid()
  ) OR 
  task_id IN (
    SELECT t.id FROM tasks t 
    JOIN public_boards pb ON t.user_id = pb.user_id 
    WHERE pb.is_active = true
  )
);