-- Fix RLS policies for chat functionality on public boards

-- Ensure sub-users can read messages from their board owner's channels
DROP POLICY IF EXISTS "Participants can view messages in their channels" ON public.chat_messages;
CREATE POLICY "Participants can view messages in their channels"
ON public.chat_messages
FOR SELECT
USING (
  -- Admin users can see messages in their own channels
  (owner_id = auth.uid()) OR
  -- Sub-users can see messages in channels owned by their board owner
  (owner_id IN (
    SELECT board_owner_id 
    FROM public.sub_users 
    WHERE id IN (
      SELECT sub_user_id 
      FROM public.chat_participants 
      WHERE channel_id = chat_messages.channel_id
        AND user_type = 'sub_user'
    )
  )) OR
  -- Participants can see messages in channels they're part of
  (channel_id IN (
    SELECT cp.channel_id
    FROM public.chat_participants cp
    WHERE (cp.user_id = auth.uid()) OR 
          (cp.sub_user_id IN (
            SELECT su.id
            FROM public.sub_users su
            WHERE su.board_owner_id = auth.uid() OR 
                  (auth.uid() IS NOT NULL AND lower(su.email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())))
          ))
  ))
);

-- Allow sub-users to send messages in channels they participate in  
DROP POLICY IF EXISTS "Participants can send messages in their channels" ON public.chat_messages;
CREATE POLICY "Participants can send messages in their channels"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  -- Admin users can send in their channels
  (sender_user_id = auth.uid() AND sender_type = 'admin') OR
  -- Sub-users can send in channels they participate in
  (sender_type = 'sub_user' AND channel_id IN (
    SELECT cp.channel_id
    FROM public.chat_participants cp
    WHERE cp.sub_user_id = sender_sub_user_id AND cp.user_type = 'sub_user'
  )) OR
  -- Board owners can send on behalf of others
  (owner_id = auth.uid())
);

-- Improve chat participants policy for sub-users
DROP POLICY IF EXISTS "read chat messages for workspace" ON public.chat_messages;
CREATE POLICY "read chat messages for workspace"
ON public.chat_messages
FOR SELECT
USING (
  -- Board owner can see all messages in their channels
  (owner_id = auth.uid()) OR
  -- Sub-users can see messages in channels they participate in
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
                WHERE sub_users.board_owner_id = auth.uid() OR
                      (auth.uid() IS NOT NULL AND lower(sub_users.email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())))
              )
            )
          ))
  ))
);