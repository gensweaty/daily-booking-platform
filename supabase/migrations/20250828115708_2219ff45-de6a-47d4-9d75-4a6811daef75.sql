-- Fix RLS policies that are breaking task functionality by removing auth.users references

-- Fix chat messages policies to not reference auth.users table directly
DROP POLICY IF EXISTS "Participants can view messages in their channels" ON public.chat_messages;
CREATE POLICY "Participants can view messages in their channels"
ON public.chat_messages
FOR SELECT
USING (
  -- Admin users can see messages in their own channels
  (owner_id = auth.uid()) OR
  -- Sub-users can see messages in channels they participate in
  (channel_id IN (
    SELECT cp.channel_id
    FROM public.chat_participants cp
    WHERE (cp.user_id = auth.uid()) OR 
          (cp.sub_user_id IN (
            SELECT su.id
            FROM public.sub_users su
            WHERE su.board_owner_id = auth.uid()
          ))
  ))
);

DROP POLICY IF EXISTS "read chat messages for workspace" ON public.chat_messages;
CREATE POLICY "read chat messages for workspace"
ON public.chat_messages
FOR SELECT
USING (
  -- Board owner can see all messages in their channels
  (owner_id = auth.uid()) OR
  -- Participants can see messages in channels they're part of
  (channel_id IN (
    SELECT chat_channels.id
    FROM public.chat_channels
    WHERE (chat_channels.owner_id = auth.uid()) OR 
          (EXISTS (
            SELECT 1
            FROM public.chat_participants cp
            WHERE cp.channel_id = chat_channels.id AND (
              cp.user_id = auth.uid() OR 
              cp.sub_user_id IN (
                SELECT sub_users.id
                FROM public.sub_users
                WHERE sub_users.board_owner_id = auth.uid()
              )
            )
          ))
  ))
);

-- Ensure tasks table RLS policies are not affected by chat changes
-- Reset tasks policies to their original working state
DROP POLICY IF EXISTS "Users can manage their own tasks" ON public.tasks;
CREATE POLICY "Users can manage their own tasks"
ON public.tasks
FOR ALL
USING (
  -- Authenticated users can manage their own tasks
  ((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)) OR
  -- Public board access for anonymous users
  ((auth.uid() IS NULL) AND (user_id IN (
    SELECT public_boards.user_id
    FROM public_boards
    WHERE public_boards.is_active = true
  )))
)
WITH CHECK (
  -- Authenticated users can create/update their own tasks
  ((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)) OR
  -- Public board access for anonymous users
  ((auth.uid() IS NULL) AND (user_id IN (
    SELECT public_boards.user_id
    FROM public_boards
    WHERE public_boards.is_active = true
  )))
);

-- Ensure task_comments RLS is working properly
DROP POLICY IF EXISTS "Users can manage task comments" ON public.task_comments;
CREATE POLICY "Users can manage task comments"
ON public.task_comments
FOR ALL
USING (
  -- Users can manage comments on their own tasks
  ((auth.uid() IS NOT NULL) AND (task_id IN (
    SELECT id FROM public.tasks WHERE user_id = auth.uid()
  ))) OR
  -- Public board access
  (task_id IN (
    SELECT t.id FROM public.tasks t
    JOIN public.public_boards pb ON t.user_id = pb.user_id
    WHERE pb.is_active = true
  ))
)
WITH CHECK (
  -- Users can create comments on their own tasks
  ((auth.uid() IS NOT NULL) AND (task_id IN (
    SELECT id FROM public.tasks WHERE user_id = auth.uid()
  ))) OR
  -- Public board access
  (task_id IN (
    SELECT t.id FROM public.tasks t
    JOIN public.public_boards pb ON t.user_id = pb.user_id
    WHERE pb.is_active = true
  ))
);