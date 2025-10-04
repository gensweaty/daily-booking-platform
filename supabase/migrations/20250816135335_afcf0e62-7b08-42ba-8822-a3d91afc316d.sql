-- Enable RLS on all chat tables to fix security warnings
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_files ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies for chat tables
-- Chat channels - only owners can manage their channels
CREATE POLICY "Owners can manage their chat channels" ON public.chat_channels
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Chat messages - participants can view/send messages in their channels
CREATE POLICY "Participants can view messages in their channels" ON public.chat_messages
  FOR SELECT USING (
    channel_id IN (
      SELECT cp.channel_id FROM public.chat_participants cp 
      WHERE (cp.user_id = auth.uid() OR cp.sub_user_id IN (
        SELECT su.id FROM public.sub_users su WHERE su.board_owner_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Participants can send messages in their channels" ON public.chat_messages
  FOR INSERT WITH CHECK (
    channel_id IN (
      SELECT cp.channel_id FROM public.chat_participants cp 
      WHERE (cp.user_id = auth.uid() OR cp.sub_user_id IN (
        SELECT su.id FROM public.sub_users su WHERE su.board_owner_id = auth.uid()
      ))
    )
  );

-- Chat participants - owners can manage participants in their channels
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

-- Chat reactions - participants can manage reactions on messages they can see
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

-- Chat message files - participants can manage files on messages they can see
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