-- Enable real-time for sub_users table
ALTER TABLE public.sub_users REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sub_users;