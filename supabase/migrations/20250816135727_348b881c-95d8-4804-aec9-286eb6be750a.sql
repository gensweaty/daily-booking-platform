-- Check and enable RLS on chat tables that don't have it yet
DO $$
DECLARE
    table_rec RECORD;
BEGIN
    -- Enable RLS on chat tables if not already enabled
    FOR table_rec IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'chat_%'
        AND tablename NOT IN (
            SELECT tablename 
            FROM pg_tables t
            JOIN pg_class c ON c.relname = t.tablename
            WHERE c.relrowsecurity = true
            AND t.schemaname = 'public'
        )
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_rec.tablename);
        RAISE NOTICE 'Enabled RLS on table: %', table_rec.tablename;
    END LOOP;
END $$;

-- Create RLS policies only if they don't exist
-- Chat messages policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'chat_messages' 
        AND policyname = 'Participants can view messages in their channels'
    ) THEN
        CREATE POLICY "Participants can view messages in their channels" ON public.chat_messages
        FOR SELECT USING (
            channel_id IN (
                SELECT cp.channel_id FROM public.chat_participants cp 
                WHERE (cp.user_id = auth.uid() OR cp.sub_user_id IN (
                    SELECT su.id FROM public.sub_users su WHERE su.board_owner_id = auth.uid()
                ))
            )
        );
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'chat_messages' 
        AND policyname = 'Participants can send messages in their channels'
    ) THEN
        CREATE POLICY "Participants can send messages in their channels" ON public.chat_messages
        FOR INSERT WITH CHECK (
            channel_id IN (
                SELECT cp.channel_id FROM public.chat_participants cp 
                WHERE (cp.user_id = auth.uid() OR cp.sub_user_id IN (
                    SELECT su.id FROM public.sub_users su WHERE su.board_owner_id = auth.uid()
                ))
            )
        );
    END IF;
END $$;

-- Chat participants policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'chat_participants' 
        AND policyname = 'Owners can manage participants in their channels'
    ) THEN
        CREATE POLICY "Owners can manage participants in their channels" ON public.chat_participants
        FOR ALL USING (
            channel_id IN (
                SELECT cc.id FROM public.chat_channels cc WHERE cc.owner_id = auth.uid()
            )
        ) WITH CHECK (
            channel_id IN (
                SELECT cc.id FROM public.chat_channels cc WHERE cc.owner_id = auth.uid()
            )
        );
    END IF;
END $$;

-- Chat reactions policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'chat_message_reactions' 
        AND policyname = 'Participants can manage reactions'
    ) THEN
        CREATE POLICY "Participants can manage reactions" ON public.chat_message_reactions
        FOR ALL USING (
            message_id IN (
                SELECT cm.id FROM public.chat_messages cm 
                WHERE cm.channel_id IN (
                    SELECT cp.channel_id FROM public.chat_participants cp 
                    WHERE (cp.user_id = auth.uid() OR cp.sub_user_id IN (
                        SELECT su.id FROM public.sub_users su WHERE su.board_owner_id = auth.uid()
                    ))
                )
            )
        ) WITH CHECK (
            message_id IN (
                SELECT cm.id FROM public.chat_messages cm 
                WHERE cm.channel_id IN (
                    SELECT cp.channel_id FROM public.chat_participants cp 
                    WHERE (cp.user_id = auth.uid() OR cp.sub_user_id IN (
                        SELECT su.id FROM public.sub_users su WHERE su.board_owner_id = auth.uid()
                    ))
                )
            )
        );
    END IF;
END $$;

-- Chat message files policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'chat_message_files' 
        AND policyname = 'Participants can manage message files'
    ) THEN
        CREATE POLICY "Participants can manage message files" ON public.chat_message_files
        FOR ALL USING (
            message_id IN (
                SELECT cm.id FROM public.chat_messages cm 
                WHERE cm.channel_id IN (
                    SELECT cp.channel_id FROM public.chat_participants cp 
                    WHERE (cp.user_id = auth.uid() OR cp.sub_user_id IN (
                        SELECT su.id FROM public.sub_users su WHERE su.board_owner_id = auth.uid()
                    ))
                )
            )
        ) WITH CHECK (
            message_id IN (
                SELECT cm.id FROM public.chat_messages cm 
                WHERE cm.channel_id IN (
                    SELECT cp.channel_id FROM public.chat_participants cp 
                    WHERE (cp.user_id = auth.uid() OR cp.sub_user_id IN (
                        SELECT su.id FROM public.sub_users su WHERE su.board_owner_id = auth.uid()
                    ))
                )
            )
        );
    END IF;
END $$;