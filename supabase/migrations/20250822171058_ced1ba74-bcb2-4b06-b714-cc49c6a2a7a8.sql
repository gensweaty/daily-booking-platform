-- add both tables (correct name) and make sure updates/deletes have OLD rows
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;