-- Enable realtime for chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;

-- Add RLS policy for realtime subscribers
CREATE POLICY "read chat messages for workspace"
ON public.chat_messages FOR SELECT
USING (
  channel_id IN (
    SELECT id FROM public.chat_channels
    WHERE owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.channel_id = chat_channels.id
      AND (cp.user_id = auth.uid() OR cp.sub_user_id IN (
        SELECT id FROM public.sub_users 
        WHERE board_owner_id = auth.uid()
      ))
    )
  )
);