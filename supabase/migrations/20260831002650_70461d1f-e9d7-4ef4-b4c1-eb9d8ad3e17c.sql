
CREATE OR REPLACE FUNCTION public.is_active_public_board_owner(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.public_boards pb WHERE pb.user_id = p_user_id AND pb.is_active = true);
$$;
GRANT EXECUTE ON FUNCTION public.is_active_public_board_owner(uuid) TO anon, authenticated, service_role;

CREATE POLICY "public_board_files_access" ON public.files FOR ALL TO anon
  USING (public.is_active_public_board_owner(user_id))
  WITH CHECK (public.is_active_public_board_owner(user_id));

CREATE POLICY "public_board_event_files_access" ON public.event_files FOR ALL TO anon
  USING (public.is_active_public_board_owner(user_id)
         OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_files.event_id AND public.is_active_public_board_owner(e.user_id)))
  WITH CHECK (public.is_active_public_board_owner(user_id)
         OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_files.event_id AND public.is_active_public_board_owner(e.user_id)));

CREATE POLICY "owner_event_files_via_event" ON public.event_files FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_files.event_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_files.event_id AND e.user_id = auth.uid()));

CREATE POLICY "public_board_customer_files_new_access" ON public.customer_files_new FOR ALL TO anon
  USING (public.is_active_public_board_owner(user_id))
  WITH CHECK (public.is_active_public_board_owner(user_id));

CREATE POLICY "public_board_customer_files_access" ON public.customer_files FOR ALL TO anon
  USING (public.is_active_public_board_owner(user_id))
  WITH CHECK (public.is_active_public_board_owner(user_id));

CREATE POLICY "public_board_note_files_access" ON public.note_files FOR ALL TO anon
  USING (public.is_active_public_board_owner(user_id))
  WITH CHECK (public.is_active_public_board_owner(user_id));

CREATE POLICY "public_board_booking_files_access" ON public.booking_files FOR ALL TO anon
  USING (public.is_active_public_board_owner(user_id))
  WITH CHECK (public.is_active_public_board_owner(user_id));

CREATE POLICY "comment_files_legacy_owner_access" ON public.comment_files FOR ALL TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid())
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "public_board_channels_read" ON public.chat_channels FOR SELECT TO anon
  USING (public.is_active_public_board_owner(owner_id));

CREATE POLICY "public_board_message_insert" ON public.chat_messages FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_channels ch WHERE ch.id = chat_messages.channel_id AND public.is_active_public_board_owner(ch.owner_id)));

CREATE POLICY "public_board_reactions_access" ON public.chat_message_reactions FOR ALL TO anon
  USING (EXISTS (SELECT 1 FROM public.chat_messages m JOIN public.chat_channels c ON c.id = m.channel_id
                 WHERE m.id = chat_message_reactions.message_id AND public.is_active_public_board_owner(c.owner_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_messages m JOIN public.chat_channels c ON c.id = m.channel_id
                 WHERE m.id = chat_message_reactions.message_id AND public.is_active_public_board_owner(c.owner_id)));

CREATE POLICY "public_board_sub_users_select" ON public.sub_users FOR SELECT TO anon
  USING (public.is_active_public_board_owner(board_owner_id));
CREATE POLICY "public_board_sub_users_insert" ON public.sub_users FOR INSERT TO anon
  WITH CHECK (public.is_active_public_board_owner(board_owner_id));
CREATE POLICY "public_board_sub_users_update" ON public.sub_users FOR UPDATE TO anon
  USING (public.is_active_public_board_owner(board_owner_id))
  WITH CHECK (public.is_active_public_board_owner(board_owner_id));
CREATE POLICY "sub_users_read_own_record" ON public.sub_users FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
CREATE POLICY "sub_users_update_own_record" ON public.sub_users FOR UPDATE TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

REVOKE SELECT ON public.sub_users FROM anon, authenticated;
GRANT SELECT (id, board_owner_id, fullname, email, created_at, last_login_at, updated_at, avatar_url,
              tasks_permission, calendar_permission, crm_permission, statistics_permission)
  ON public.sub_users TO anon, authenticated;
GRANT ALL ON public.sub_users TO service_role;

DROP POLICY IF EXISTS "Allow anonymous read access" ON public.redeem_codes;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.redeem_codes;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.redeem_codes;
REVOKE SELECT ON public.redeem_codes FROM anon, authenticated;
GRANT ALL ON public.redeem_codes TO service_role;

CREATE OR REPLACE FUNCTION public.is_redeem_code_available(p_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.redeem_codes rc WHERE rc.code = btrim(p_code) AND rc.is_used = false);
$$;
GRANT EXECUTE ON FUNCTION public.is_redeem_code_available(text) TO anon, authenticated, service_role;

REVOKE ALL ON public.checkout_sessions FROM anon, authenticated;
REVOKE ALL ON public.stripe_webhook_events FROM anon, authenticated;
GRANT ALL ON public.checkout_sessions TO service_role;
GRANT ALL ON public.stripe_webhook_events TO service_role;

ALTER TABLE public.booking_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_board_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "excel_reports_public_read" ON storage.objects;

DROP POLICY IF EXISTS "Give users authenticated access to task_attachments 1zxc4v2" ON storage.objects;
CREATE POLICY "task_attachments_read" ON storage.objects FOR SELECT USING (bucket_id = 'task_attachments');
CREATE POLICY "task_attachments_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'task_attachments');
CREATE POLICY "task_attachments_modify_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'task_attachments');
CREATE POLICY "task_attachments_delete_auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'task_attachments');

DROP POLICY IF EXISTS "Allow public deletes from chat_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates to chat_attachments" ON storage.objects;
CREATE POLICY "chat_attachments_delete_auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'chat_attachments');
CREATE POLICY "chat_attachments_update_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'chat_attachments');

DROP POLICY IF EXISTS "Allow public access to delete customer files" ON storage.objects;

DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proconfig IS NULL AND p.prokind = 'f'
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', r.nspname, r.proname, r.args);
  END LOOP;
END
$do$;
