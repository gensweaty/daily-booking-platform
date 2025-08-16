-- Create chat system tables
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '💬',
  is_default BOOLEAN DEFAULT false,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sub_user_id UUID REFERENCES public.sub_users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'sub_user')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(channel_id, user_id, sub_user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_sub_user_id UUID REFERENCES public.sub_users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'sub_user')),
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sub_user_id UUID REFERENCES public.sub_users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'sub_user')),
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id, sub_user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.chat_message_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content_type TEXT,
  size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all chat tables
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_channels
CREATE POLICY "Users can view channels they own or participate in"
ON public.chat_channels FOR SELECT
USING (
  auth.uid() = owner_id OR
  id IN (
    SELECT channel_id FROM public.chat_participants 
    WHERE (user_id = auth.uid() AND user_type = 'admin') OR
          (sub_user_id IN (
            SELECT id FROM public.sub_users 
            WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
          ) AND user_type = 'sub_user')
  )
);

CREATE POLICY "Users can create channels they own"
ON public.chat_channels FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Channel owners can update their channels"
ON public.chat_channels FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Channel owners can delete their channels"
ON public.chat_channels FOR DELETE
USING (auth.uid() = owner_id);

-- RLS Policies for chat_participants
CREATE POLICY "Users can view participants in their channels"
ON public.chat_participants FOR SELECT
USING (
  channel_id IN (
    SELECT id FROM public.chat_channels 
    WHERE owner_id = auth.uid() OR
          id IN (
            SELECT channel_id FROM public.chat_participants 
            WHERE (user_id = auth.uid() AND user_type = 'admin') OR
                  (sub_user_id IN (
                    SELECT id FROM public.sub_users 
                    WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
                  ) AND user_type = 'sub_user')
          )
  )
);

CREATE POLICY "Channel owners can manage participants"
ON public.chat_participants FOR ALL
USING (
  channel_id IN (SELECT id FROM public.chat_channels WHERE owner_id = auth.uid())
);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages in their channels"
ON public.chat_messages FOR SELECT
USING (
  channel_id IN (
    SELECT id FROM public.chat_channels 
    WHERE owner_id = auth.uid() OR
          id IN (
            SELECT channel_id FROM public.chat_participants 
            WHERE (user_id = auth.uid() AND user_type = 'admin') OR
                  (sub_user_id IN (
                    SELECT id FROM public.sub_users 
                    WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
                  ) AND user_type = 'sub_user')
          )
  )
);

CREATE POLICY "Users can send messages to channels they participate in"
ON public.chat_messages FOR INSERT
WITH CHECK (
  (sender_type = 'admin' AND sender_user_id = auth.uid()) OR
  (sender_type = 'sub_user' AND sender_sub_user_id IN (
    SELECT id FROM public.sub_users 
    WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  )) AND
  channel_id IN (
    SELECT channel_id FROM public.chat_participants 
    WHERE (user_id = auth.uid() AND user_type = 'admin') OR
          (sub_user_id IN (
            SELECT id FROM public.sub_users 
            WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
          ) AND user_type = 'sub_user')
  )
);

-- RLS Policies for chat_message_reactions
CREATE POLICY "Users can view reactions in their channels"
ON public.chat_message_reactions FOR SELECT
USING (
  message_id IN (
    SELECT id FROM public.chat_messages 
    WHERE channel_id IN (
      SELECT id FROM public.chat_channels 
      WHERE owner_id = auth.uid() OR
            id IN (
              SELECT channel_id FROM public.chat_participants 
              WHERE (user_id = auth.uid() AND user_type = 'admin') OR
                    (sub_user_id IN (
                      SELECT id FROM public.sub_users 
                      WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
                    ) AND user_type = 'sub_user')
            )
    )
  )
);

CREATE POLICY "Users can add reactions to messages in their channels"
ON public.chat_message_reactions FOR INSERT
WITH CHECK (
  ((user_type = 'admin' AND user_id = auth.uid()) OR
   (user_type = 'sub_user' AND sub_user_id IN (
     SELECT id FROM public.sub_users 
     WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
   ))) AND
  message_id IN (
    SELECT id FROM public.chat_messages 
    WHERE channel_id IN (
      SELECT channel_id FROM public.chat_participants 
      WHERE (user_id = auth.uid() AND user_type = 'admin') OR
            (sub_user_id IN (
              SELECT id FROM public.sub_users 
              WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
            ) AND user_type = 'sub_user')
    )
  )
);

CREATE POLICY "Users can delete their own reactions"
ON public.chat_message_reactions FOR DELETE
USING (
  (user_type = 'admin' AND user_id = auth.uid()) OR
  (user_type = 'sub_user' AND sub_user_id IN (
    SELECT id FROM public.sub_users 
    WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  ))
);

-- RLS Policies for chat_message_files
CREATE POLICY "Users can view files in their channels"
ON public.chat_message_files FOR SELECT
USING (
  message_id IN (
    SELECT id FROM public.chat_messages 
    WHERE channel_id IN (
      SELECT id FROM public.chat_channels 
      WHERE owner_id = auth.uid() OR
            id IN (
              SELECT channel_id FROM public.chat_participants 
              WHERE (user_id = auth.uid() AND user_type = 'admin') OR
                    (sub_user_id IN (
                      SELECT id FROM public.sub_users 
                      WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
                    ) AND user_type = 'sub_user')
            )
    )
  )
);

CREATE POLICY "Users can upload files to messages in their channels"
ON public.chat_message_files FOR INSERT
WITH CHECK (
  message_id IN (
    SELECT id FROM public.chat_messages 
    WHERE channel_id IN (
      SELECT channel_id FROM public.chat_participants 
      WHERE (user_id = auth.uid() AND user_type = 'admin') OR
            (sub_user_id IN (
              SELECT id FROM public.sub_users 
              WHERE lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
            ) AND user_type = 'sub_user')
    )
  )
);

-- Create indexes for better performance
CREATE INDEX idx_chat_channels_owner_id ON public.chat_channels(owner_id);
CREATE INDEX idx_chat_participants_channel_id ON public.chat_participants(channel_id);
CREATE INDEX idx_chat_participants_user_id ON public.chat_participants(user_id);
CREATE INDEX idx_chat_participants_sub_user_id ON public.chat_participants(sub_user_id);
CREATE INDEX idx_chat_messages_channel_id ON public.chat_messages(channel_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX idx_chat_message_reactions_message_id ON public.chat_message_reactions(message_id);
CREATE INDEX idx_chat_message_files_message_id ON public.chat_message_files(message_id);

-- Create function to automatically create default channel for new admins
CREATE OR REPLACE FUNCTION create_default_chat_channel()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.chat_channels (owner_id, name, emoji, is_default)
  VALUES (NEW.id, 'General', '💬', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create default channel
CREATE TRIGGER on_user_created_chat_channel
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_chat_channel();