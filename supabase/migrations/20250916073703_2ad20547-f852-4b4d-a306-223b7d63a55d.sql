-- ROLLBACK TO WORKING STATE: Restore file uploads to working state from migration 20250915095928
-- This removes all the problematic rollback changes and restores proper RLS with working policies

-- ========================================
-- STEP 1: CLEAN UP CURRENT BROKEN STATE
-- ========================================

-- Remove current broken storage policies
DROP POLICY IF EXISTS "allow insert attachments (auth)" ON storage.objects;
DROP POLICY IF EXISTS "allow insert attachments (anon)" ON storage.objects;
DROP POLICY IF EXISTS "public read attachments" ON storage.objects;
DROP POLICY IF EXISTS "update attachments (auth)" ON storage.objects;
DROP POLICY IF EXISTS "delete attachments (auth)" ON storage.objects;
DROP POLICY IF EXISTS "simple_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "simple_public_read_attachments" ON storage.objects;

-- ========================================
-- STEP 2: RESTORE PROPER RLS ON FILE TABLES
-- ========================================

-- Re-enable RLS on file tables (they were disabled in rollback migrations)
ALTER TABLE public.event_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_files_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Keep task_comments and chat_messages with RLS disabled (they were causing issues)
-- They were disabled in the last migration

-- ========================================
-- STEP 3: RESTORE WORKING STORAGE POLICIES FROM MIGRATION 20250915095928
-- ========================================

-- Public read for attachment buckets (essential for public boards)
CREATE POLICY "public select attachments"
ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id IN (
  'event_attachments',
  'customer_attachments',
  'booking_attachments',
  'task_attachments',
  'comment_attachments',
  'chat_attachments',
  'note_attachments'
));

-- Owner-based policies for authenticated users (working policies)
CREATE POLICY "objects_select_own"
ON storage.objects
FOR SELECT TO authenticated
USING (owner = auth.uid());

CREATE POLICY "objects_insert_own"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (owner = auth.uid());

CREATE POLICY "objects_update_own"
ON storage.objects
FOR UPDATE TO authenticated
USING (owner = auth.uid());

CREATE POLICY "objects_delete_own"
ON storage.objects
FOR DELETE TO authenticated
USING (owner = auth.uid());

-- Allow public (anon) uploads ONLY to public-board buckets
CREATE POLICY "public insert event/customer attachments"
ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id IN ('event_attachments','customer_attachments'));

-- ========================================
-- STEP 4: RESTORE WORKING FILE TABLE POLICIES
-- ========================================

-- event_files policies (restore from 20250915095928)
DROP POLICY IF EXISTS event_files_sel_own ON public.event_files;
DROP POLICY IF EXISTS event_files_ins_own ON public.event_files;
DROP POLICY IF EXISTS event_files_upd_own ON public.event_files;
DROP POLICY IF EXISTS event_files_del_own ON public.event_files;
DROP POLICY IF EXISTS event_files_sel_public ON public.event_files;

CREATE POLICY event_files_sel_own ON public.event_files
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.user_id = auth.uid())
);

CREATE POLICY event_files_ins_own ON public.event_files
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.user_id = auth.uid())
);

CREATE POLICY event_files_upd_own ON public.event_files
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY event_files_del_own ON public.event_files
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Public read for events that belong to an active public board
CREATE POLICY event_files_sel_public ON public.event_files
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.public_boards pb ON pb.user_id = e.user_id AND pb.is_active = true
    WHERE e.id = event_id
  )
);

-- customer_files_new policies (restore from 20250915095928)
DROP POLICY IF EXISTS customer_files_ins_own ON public.customer_files_new;
DROP POLICY IF EXISTS customer_files_sel_own ON public.customer_files_new;
DROP POLICY IF EXISTS customer_files_upd_own ON public.customer_files_new;
DROP POLICY IF EXISTS customer_files_del_own ON public.customer_files_new;
DROP POLICY IF EXISTS customer_files_sel_public ON public.customer_files_new;

CREATE POLICY customer_files_sel_own ON public.customer_files_new
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
);

CREATE POLICY customer_files_ins_own ON public.customer_files_new
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
);

CREATE POLICY customer_files_upd_own ON public.customer_files_new
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY customer_files_del_own ON public.customer_files_new
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Public read for customers that belong to an active public board
CREATE POLICY customer_files_sel_public ON public.customer_files_new
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.customers c
    JOIN public.public_boards pb ON pb.user_id = c.user_id AND pb.is_active = true
    WHERE c.id = customer_id
  )
);

-- ========================================
-- STEP 5: RESTORE OTHER FILE TABLE POLICIES (SIMPLE OWNER-BASED)
-- ========================================

-- note_files
CREATE POLICY "note_files_select" ON public.note_files
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "note_files_insert" ON public.note_files
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "note_files_update" ON public.note_files
FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "note_files_delete" ON public.note_files
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- files (task files)
CREATE POLICY "files_select" ON public.files
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "files_insert" ON public.files
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "files_update" ON public.files
FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "files_delete" ON public.files
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- comment_files
CREATE POLICY "comment_files_select" ON public.comment_files
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "comment_files_insert" ON public.comment_files
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "comment_files_update" ON public.comment_files
FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "comment_files_delete" ON public.comment_files
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- chat_message_files (no RLS policies needed - allow all authenticated users)
CREATE POLICY "chat_message_files_select" ON public.chat_message_files
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "chat_message_files_insert" ON public.chat_message_files
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "chat_message_files_update" ON public.chat_message_files
FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "chat_message_files_delete" ON public.chat_message_files
FOR DELETE TO authenticated
USING (true);

-- booking_files
CREATE POLICY "booking_files_select" ON public.booking_files
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "booking_files_insert" ON public.booking_files
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "booking_files_update" ON public.booking_files
FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "booking_files_delete" ON public.booking_files
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ========================================
-- STEP 6: ENSURE WORKING RPCs ARE AVAILABLE
-- ========================================

-- Restore the public insert RPCs that were working
GRANT EXECUTE ON FUNCTION public.public_insert_event_file(uuid, uuid, text, text, text, bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_insert_customer_file(uuid, uuid, text, text, text, bigint) TO anon, authenticated;