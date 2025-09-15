-- Enable RLS on all public tables that have policies but RLS disabled
-- This fixes the "Policy Exists RLS Disabled" errors

-- Core CRM and Event tables
ALTER TABLE public.booking_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Chat system tables
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- File management tables
ALTER TABLE public.comment_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_files_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- User and access management tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_board_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;

-- System tables
ALTER TABLE public.reminder_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;