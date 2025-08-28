-- Enable RLS on tables that don't already have it
DO $$
BEGIN
    -- Only enable RLS if not already enabled
    IF NOT (SELECT COALESCE(rowsecurity, false) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscription_plans') THEN
        ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT (SELECT COALESCE(rowsecurity, false) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
        ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT (SELECT COALESCE(rowsecurity, false) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sub_users') THEN
        ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT (SELECT COALESCE(rowsecurity, false) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'task_comments') THEN
        ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT (SELECT COALESCE(rowsecurity, false) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tasks') THEN
        ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Add missing RLS policies conditionally
DO $$
BEGIN
    -- Add subscription plans policy if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscription_plans' AND policyname = 'Allow public read access to subscription plans') THEN
        CREATE POLICY "Allow public read access to subscription plans" 
        ON public.subscription_plans 
        FOR SELECT 
        TO authenticated, anon
        USING (true);
    END IF;
    
    -- Add sub_users policy if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sub_users' AND policyname = 'Board owners can manage their sub-users') THEN
        CREATE POLICY "Board owners can manage their sub-users" 
        ON public.sub_users 
        FOR ALL 
        TO authenticated
        USING (board_owner_id = auth.uid())
        WITH CHECK (board_owner_id = auth.uid());
    END IF;
    
    -- Add task_comments policy if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_comments' AND policyname = 'Users can manage comments on their tasks') THEN
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
    END IF;
END $$;